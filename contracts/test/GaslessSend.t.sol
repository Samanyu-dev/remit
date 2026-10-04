// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RemitEscrow, IERC20} from "../src/RemitEscrow.sol";
import {TestUSD} from "../src/TestUSD.sol";

contract GaslessSendTest is Test {
    TestUSD usd;
    RemitEscrow esc;
    uint256 alicePk = 0xA11CE;
    address alice;
    address claimKey = makeAddr("claimKey");
    uint64 expiry;
    uint256 validBefore;

    function setUp() public {
        usd = new TestUSD();
        esc = new RemitEscrow(IERC20(address(usd)));
        alice = vm.addr(alicePk);
        usd.mint(alice, 100e6);
        expiry = uint64(block.timestamp + 7 days);
        validBefore = block.timestamp + 1 hours;
    }

    function _auth(uint256 value, address key) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                usd.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), alice, address(esc), value, 0, validBefore, esc.authNonce(key, expiry)
            )
        );
        return vm.sign(alicePk, keccak256(abi.encodePacked("\x19\x01", usd.DOMAIN_SEPARATOR(), structHash)));
    }

    function test_relayerSubmitsWithoutAliceGas() public {
        (uint8 v, bytes32 r, bytes32 s) = _auth(25e6, claimKey);
        vm.prank(makeAddr("relayer"));
        uint256 id = esc.sendWithAuthorization(alice, 25e6, claimKey, expiry, validBefore, v, r, s, "");
        (address sender, address key, uint96 amount,) = esc.links(id);
        assertEq(sender, alice);
        assertEq(key, claimKey);
        assertEq(amount, 25e6);
        assertEq(usd.balanceOf(address(esc)), 25e6);
    }

    function test_relayerCantSwapClaimKey() public {
        (uint8 v, bytes32 r, bytes32 s) = _auth(25e6, claimKey);
        vm.expectRevert("invalid signature");
        esc.sendWithAuthorization(alice, 25e6, makeAddr("relayerKey"), expiry, validBefore, v, r, s, "");
    }

    function test_relayerCantChangeAmount() public {
        (uint8 v, bytes32 r, bytes32 s) = _auth(25e6, claimKey);
        vm.expectRevert("invalid signature");
        esc.sendWithAuthorization(alice, 90e6, claimKey, expiry, validBefore, v, r, s, "");
    }

    function test_noReplay() public {
        (uint8 v, bytes32 r, bytes32 s) = _auth(25e6, claimKey);
        esc.sendWithAuthorization(alice, 25e6, claimKey, expiry, validBefore, v, r, s, "");
        vm.expectRevert("authorization used");
        esc.sendWithAuthorization(alice, 25e6, claimKey, expiry, validBefore, v, r, s, "");
    }

    function test_onlyEscrowCanRedeemAuth() public {
        (uint8 v, bytes32 r, bytes32 s) = _auth(25e6, claimKey);
        bytes32 nonce = esc.authNonce(claimKey, expiry);
        vm.expectRevert("caller must be payee");
        usd.receiveWithAuthorization(alice, address(esc), 25e6, 0, validBefore, nonce, v, r, s);
    }
}
