// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Pool.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title PoolFactory
 */
contract PoolFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    address private _serviceConfiguration;

    /**
     * @dev Emitted when a pool is created.
     */
    event PoolCreated(address indexed addr);

    constructor(address serviceConfiguration) {
        _serviceConfiguration = serviceConfiguration;
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool(
        address liquidityAsset,
        address withdrawControllerFactory,
        IPoolConfigurableSettings calldata settings
    ) public virtual returns (address poolAddress) {
        require(
            IServiceConfiguration(_serviceConfiguration).paused() == false,
            "PoolFactory: Protocol paused"
        );
        require(
            settings.withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );
        require(
            withdrawControllerFactory != address(0),
            "PoolFactory: Invalid address"
        );
        if (settings.fixedFee > 0) {
            require(
                settings.fixedFeeInterval > 0,
                "PoolFactory: Invalid fixed fee interval"
            );
        }

        // Create the pool
        Pool pool = new Pool(
            liquidityAsset,
            msg.sender,
            _serviceConfiguration,
            withdrawControllerFactory,
            settings,
            "PerimeterPoolToken",
            "PPT"
        );

        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
