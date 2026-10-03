// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RemitEscrow, IERC20} from "../src/RemitEscrow.sol";
import {TestUSD} from "../src/TestUSD.sol";

/// TOKEN unset => deploys TestUSD (testnet). Set TOKEN=<AUSD address> for mainnet.
contract Deploy is Script {
    function run() external {
        address token = vm.envOr("TOKEN", address(0));
        vm.startBroadcast();
        if (token == address(0)) token = address(new TestUSD());
        RemitEscrow esc = new RemitEscrow(IERC20(token));
        vm.stopBroadcast();
        console.log("TOKEN", token);
        console.log("ESCROW", address(esc));
    }
}
