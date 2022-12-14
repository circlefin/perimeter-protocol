// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../interfaces/IPool.sol";

/**
 * @title Interface for the PoolController factory.
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
        address pool,
        address serviceConfiguration,
        address admin,
        address liquidityAsset,
        address vaultFactory,
        IPoolConfigurableSettings memory poolSettings
    ) external returns (address);
}
