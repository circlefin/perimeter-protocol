// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The interface for controlling access to Pools
 */
interface IPoolWithdrawManagerFactory {
    /**
     * @dev Emitted when a pool is created.
     */
    event PoolWithdrawManagerCreated(address indexed addr);

    /**
     * @dev Creates a pool's withdraw manager
     * @dev Emits `PoolWithdrawManagerCreated` event.
     */
    function createPoolWithdrawManager(address) external returns (address);
}
