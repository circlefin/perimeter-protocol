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

    address private _loan;
    address private _pool;
    IERC20 private _asset;

    /**
     * @dev Modifier restricting access to pool
     */
    modifier onlyPool() {
        require(msg.sender == _pool, "FirstLossVault: caller not pool");
        _;
    }

    /**
     * @dev Constructor for the vault
     * @param pool address of pool "owner"
     * @param asset asset held by vault
     */
    constructor(
        address pool,
        address loan,
        address asset
    ) {
        _pool = pool;
        _loan = loan;
        _asset = IERC20(asset);
    }

    /**
     * @dev Allows withdrawal of funds held by vault.
     */
    function withdraw(uint256 amount, address receiver) external onlyPool {
        require(receiver != address(0), "FundingVault: 0 address");
        _asset.safeTransfer(receiver, amount);
    }
}
