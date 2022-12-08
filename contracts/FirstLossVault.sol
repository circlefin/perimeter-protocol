// SPDX-License-Identifier: MIT
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

    address public poolController;
    IERC20 private _asset;

    /**
     * @dev Modifier restricting access to pool
     */
    modifier onlyPoolController() {
        require(
            msg.sender == poolController,
            "FirstLossVault: caller not pool controller"
        );
        _;
    }

    /**
     * @dev Constructor for the vault
     * @param _poolController address of pool controller
     * @param firstLossAsset asset held by vault
     */
    constructor(address _poolController, address firstLossAsset) {
        poolController = _poolController;
        _asset = IERC20(firstLossAsset);
    }

    /**
     * @dev Returns the asset held by the vault.
     */
    function asset() external view returns (address) {
        return address(_asset);
    }

    /**
     * @dev Allows withdrawal of funds held by vault.
     */
    function withdraw(uint256 amount, address receiver)
        external
        onlyPoolController
    {
        require(receiver != address(0), "FirstLossVault: 0 address");
        _asset.safeTransfer(receiver, amount);
    }
}
