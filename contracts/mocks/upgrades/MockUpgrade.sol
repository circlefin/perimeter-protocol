// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

abstract contract MockUpgrade {
    function foo() external pure returns (bool) {
        return true;
    }
}
