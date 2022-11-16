// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Pool.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./interfaces/IPoolFactory.sol";

/**
 * @title PoolFactory
 */
contract PoolFactory is IPoolFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    address private _serviceConfiguration;

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
        address poolControllerFactory,
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
            withdrawControllerFactory != address(0) &&
                poolControllerFactory != address(0),
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
            poolControllerFactory,
            settings,
            "PerimeterPoolToken",
            "PPT"
        );

        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
