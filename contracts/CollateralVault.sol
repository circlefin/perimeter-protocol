// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CollateralVault {
    using SafeERC20 for IERC20;

    address private immutable _loan;

    modifier onlyLoan() {
        require(msg.sender == _loan, "CollateralVault: caller not loan");
        _;
    }

    constructor(address loan) {
        _loan = loan;
    }
}
