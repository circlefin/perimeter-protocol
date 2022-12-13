// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title Interface for the WithdrawController factory.
 */
interface IWithdrawControllerFactory {
    /**
     * @dev Emitted when a pool WithdrawController is created.
     */
    event WithdrawControllerCreated(address indexed addr);

    /**
     * @dev Creates a pool's withdraw controller
     * @dev Emits `WithdrawControllerCreated` event.
     */
    function createController(address) external returns (address);
}
