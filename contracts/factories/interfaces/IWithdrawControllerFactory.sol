// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title The interface for controlling access to Pools
 */
interface IWithdrawControllerFactory {
    /**
     * @dev Emitted when a pool is created.
     */
    event WithdrawControllerCreated(address indexed addr);

    /**
     * @dev Creates a pool's withdraw controller
     * @dev Emits `WithdrawControllerCreated` event.
     */
    function createController(address) external returns (address);
}
