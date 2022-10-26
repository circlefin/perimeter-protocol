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
    IServiceConfiguration private _serviceConfiguration;

    /**
     * @dev Emitted when a pool is created.
     */
    event PoolCreated(address indexed addr);

    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool(
        address liquidityAsset,
        IPoolConfigurableSettings calldata settings
    ) public virtual returns (address poolAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "PoolFactory: Protocol paused"
        );
        require(
            settings.withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );
        if (settings.fixedFee > 0) {
            require(
                settings.fixedFeeInterval > 0,
                "PoolFactory: Invalid fixed fee interval"
            );
        }

        Pool pool = new Pool(
            liquidityAsset,
            msg.sender,
            address(_serviceConfiguration),
            settings,
            "ValyriaPoolToken",
            "VPT"
        );
        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
