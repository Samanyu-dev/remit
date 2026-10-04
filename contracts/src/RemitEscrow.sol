// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    // EIP-3009, supported by AUSD on Monad mainnet.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// Send-by-link escrow. The link carries a one-off private key ("claim key").
/// The recipient proves they hold it by signing their own address, so a
/// claim can't be front-run, and anyone (e.g. our relayer) can submit it,
/// meaning the recipient needs no gas.
contract RemitEscrow {
    struct Link {
        address sender;
        address claimKey;
        uint96 amount;
        uint64 expiry;
    }

    IERC20 public immutable token;
    uint256 public nextId;
    mapping(uint256 => Link) public links;

    event Sent(uint256 indexed id, address indexed sender, address indexed claimKey, uint256 amount, uint64 expiry);
    event Claimed(uint256 indexed id, address indexed to);
    event Refunded(uint256 indexed id);

    constructor(IERC20 _token) {
        token = _token;
    }

    function send(uint96 amount, address claimKey, uint64 expiry) external returns (uint256 id) {
        id = _open(msg.sender, amount, claimKey, expiry);
        require(token.transferFrom(msg.sender, address(this), amount), "pull failed");
    }

    /// Gasless send: `from` signs an EIP-3009 ReceiveWithAuthorization to this contract and
    /// anyone (our relayer) submits it. The nonce commits to the claim key and expiry, so a
    /// submitter who swaps them in produces a different nonce and the signature fails.
    function sendWithAuthorization(
        address from,
        uint96 amount,
        address claimKey,
        uint64 expiry,
        uint256 validBefore,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 id) {
        id = _open(from, amount, claimKey, expiry);
        token.receiveWithAuthorization(
            from, address(this), amount, 0, validBefore, authNonce(claimKey, expiry), v, r, s
        );
    }

    function authNonce(address claimKey, uint64 expiry) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), claimKey, expiry));
    }

    function _open(address sender, uint96 amount, address claimKey, uint64 expiry) private returns (uint256 id) {
        require(amount > 0, "zero amount");
        require(claimKey != address(0), "no claim key");
        require(expiry > block.timestamp, "expired");
        id = nextId++;
        links[id] = Link(sender, claimKey, amount, expiry);
        emit Sent(id, sender, claimKey, amount, expiry);
    }

    /// sig = claimKey's eth_sign over claimDigest(id, to).
    function claim(uint256 id, address to, bytes calldata sig) external {
        Link memory l = links[id];
        require(l.amount > 0, "not claimable");
        require(to != address(0), "no recipient");
        require(_recover(claimDigest(id, to), sig) == l.claimKey, "bad signature");
        delete links[id];
        require(token.transfer(to, l.amount), "push failed");
        emit Claimed(id, to);
    }

    function refund(uint256 id) external {
        Link memory l = links[id];
        require(l.amount > 0, "not refundable");
        require(msg.sender == l.sender, "not sender");
        require(block.timestamp >= l.expiry, "not expired");
        delete links[id];
        require(token.transfer(l.sender, l.amount), "push failed");
        emit Refunded(id);
    }

    /// EIP-191 personal_sign hash, so viem's account.signMessage({ message: { raw } }) works.
    function claimDigest(uint256 id, address to) public view returns (bytes32) {
        bytes32 inner = keccak256(abi.encode(block.chainid, address(this), id, to));
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, "bad sig length");
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // Claim keys are single-use and links are deleted on claim, so malleability is harmless.
        return ecrecover(digest, v, r, s);
    }
}
