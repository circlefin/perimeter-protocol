// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../../upgrades/BeaconImplementation.sol";

contract MockBeaconImplementation is BeaconImplementation {
    function foo() external pure virtual returns (string memory) {
        return "bar";
    }

    function initialize() public initializer {}
}

contract MockBeaconImplementationV2 is MockBeaconImplementation {
    function foo() external pure override returns (string memory) {
        return "baz";
    }
}
