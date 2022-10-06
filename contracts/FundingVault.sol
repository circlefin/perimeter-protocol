// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FundingVault
 *
 * Holds liquidity asset for a given loan.
 */
contract FundingVault {
    using SafeERC20 for IERC20;

    address private immutable _loan;
    IERC20 private immutable _asset;

    /**
     * @dev Modifier restricting access to pool
     */
    modifier onlyLoan() {
        require(msg.sender == _loan, "FundingVault: caller not loan");
        _;
    }

    /**
     * @dev Constructor for the vault
     * @param loan address of loan
     * @param asset asset held by vault
     */
    constructor(address loan, address asset) {
        _loan = loan;
        _asset = IERC20(asset);
    }

    /**
     * @dev Allows withdrawal of funds held by vault.
     */
    function withdraw(uint256 amount, address receiver) external onlyLoan {
        require(receiver != address(0), "FundingVault: 0 address");
        _asset.safeTransfer(receiver, amount);
    }
}
