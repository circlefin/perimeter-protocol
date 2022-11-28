// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../../interfaces/IPool.sol";

/**
 * @title The interface for controlling access to Pools
 */
interface IPoolControllerFactory {
    /**
     * @dev Emitted when a pool is created.
     */
    event PoolControllerCreated(address indexed pool, address indexed addr);

    /**
     * @dev Creates a pool's PoolAdmin controller
     * @dev Emits `PoolControllerCreated` event.
     */
    function createController(
        address,
        address,
        address,
        address,
        IPoolConfigurableSettings memory
    ) external returns (address);
}
