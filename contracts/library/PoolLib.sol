// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../PoolLifeCycleState.sol";

/**
 * @title Collection of functions used by the Pool
 */
library PoolLib {
    using SafeERC20 for IERC20;

    /**
     * @dev See IPool for event definition.
     */
    event LifeCycleStateTransition(PoolLifeCycleState state);

    /**
     * @dev Emitted when first loss is supplied to the pool.
     */
    event FirstLossSupplied(address indexed supplier, uint256 amount);

    /**
     * @dev Transfers first loss to the locker.
     * @param liquidityAsset Pool liquidity asset
     * @param amount Amount of first loss being contributed
     * @param currentState Lifecycle state of the pool
     * @param minFirstLossRequired The minimum amount of first loss the pool needs to become active
     * @return newState The updated Pool lifecycle state
     */
    function executeFirstLossContribution(
        address liquidityAsset,
        uint256 amount,
        address firstLossLocker,
        PoolLifeCycleState currentState,
        uint256 minFirstLossRequired
    ) external returns (PoolLifeCycleState newState) {
        require(firstLossLocker != address(0), "Pool: 0 address");

        IERC20(liquidityAsset).safeTransferFrom(
            msg.sender,
            firstLossLocker,
            amount
        );
        newState = currentState;

        // Graduate pool state if needed
        if (
            currentState == PoolLifeCycleState.Initialized &&
            (amount >= minFirstLossRequired ||
                IERC20(liquidityAsset).balanceOf(address(firstLossLocker)) >=
                minFirstLossRequired)
        ) {
            newState = PoolLifeCycleState.Active;
            emit LifeCycleStateTransition(newState);
        }
        emit FirstLossSupplied(msg.sender, amount);
    }
}
