// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

contract MockParent {
    uint8 private _decimals;

    modifier bar() {
        require(false);
        _;
    }

    constructor() {}

    function foo() public pure virtual bar returns (bool) {
        return true;
    }
}

contract MockChild is MockParent {}

contract MockChild2 is MockParent {
    function foo() public pure override returns (bool) {
        super.foo();
        return true;
    }
}

contract MockChild3 is MockParent {
    function foo() public pure override returns (bool) {
        return true;
    }
}
