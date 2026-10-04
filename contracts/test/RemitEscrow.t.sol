// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RemitEscrow, IERC20} from "../src/RemitEscrow.sol";

contract MockUSD {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[to] += a; return true;
    }
}

contract RemitEscrowTest is Test {
    MockUSD usd;
    RemitEscrow esc;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 claimPk = 0xC1A1;

    function setUp() public {
        usd = new MockUSD();
        esc = new RemitEscrow(IERC20(address(usd)));
        usd.mint(alice, 100e6);
        vm.prank(alice);
        usd.approve(address(esc), type(uint256).max);
    }

    function _send() internal returns (uint256) {
        vm.prank(alice);
        return esc.send(25e6, vm.addr(claimPk), uint64(block.timestamp + 7 days), hex"c0ffee");
    }

    function _sig(uint256 pk, uint256 id, address to) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, esc.claimDigest(id, to));
        return abi.encodePacked(r, s, v);
    }

    function test_claim() public {
        uint256 id = _send();
        bytes memory sig = _sig(claimPk, id, bob);
        esc.claim(id, bob, sig); // relayer submits
        assertEq(usd.balanceOf(bob), 25e6);
        vm.expectRevert("not claimable");
        esc.claim(id, bob, sig);
    }

    function test_frontrunCantRedirect() public {
        uint256 id = _send();
        bytes memory sig = _sig(claimPk, id, bob);
        vm.expectRevert("bad signature");
        esc.claim(id, makeAddr("mallory"), sig);
    }

    function test_memoTooLong() public {
        vm.prank(alice);
        vm.expectRevert("memo too long");
        esc.send(1e6, vm.addr(claimPk), uint64(block.timestamp + 1 days), new bytes(513));
    }

    function test_refundOnlyAfterExpiry() public {
        uint256 id = _send();
        vm.prank(alice);
        vm.expectRevert("not expired");
        esc.refund(id);
        vm.warp(block.timestamp + 7 days);
        vm.prank(bob);
        vm.expectRevert("not sender");
        esc.refund(id);
        vm.prank(alice);
        esc.refund(id);
        assertEq(usd.balanceOf(alice), 100e6);
    }
}
