// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FirstLossVault
 *
 * Holder for first-loss funds for a given pool.
 */
contract FirstLossVault {
    using SafeERC20 for IERC20;

    address private _pool;
    IERC20 private _asset;

    /**
     * @dev Modifier restricting access to pool
     */
    modifier isPool() {
        require(msg.sender == _pool, "FirstLossVault: caller not pool");
        _;
    }

    /**
     * @dev Constructor for the vault
     * @param associatedPool address of pool "owner"
     * @param firstLossAsset asset held by vault
     */
    constructor(address associatedPool, address firstLossAsset) {
        _pool = associatedPool;
        _asset = IERC20(firstLossAsset);
    }

    /**
     * @dev Returns the asset held by the vault.
     */
    function asset() external view returns (address) {
        return address(_asset);
    }

    /**
     * @dev Returns the pool controlling the vault.
     */
    function pool() external view returns (address) {
        return _pool;
    }

    /**
     * @dev Allows withdrawal of funds held by vault.
     */
    function withdraw(uint256 amount, address receiver) external isPool {
        require(receiver != address(0), "FirstLossVault: 0 address");
        _asset.safeTransfer(receiver, amount);
    }
}
