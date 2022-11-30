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

    /**
     * @dev Reference to the WithdrawControllerFactory contract
     */
    address private _withdrawControllerFactory;

    /**
     * @dev Reference to the PoolControllerFactory contract
     */
    address private _poolControllerFactory;

    constructor(
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory
    ) {
        _serviceConfiguration = serviceConfiguration;
        _withdrawControllerFactory = withdrawControllerFactory;
        _poolControllerFactory = poolControllerFactory;
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
            IServiceConfiguration(_serviceConfiguration).paused() == false,
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
        require(
            settings.firstLossInitialMinimum >=
                IServiceConfiguration(_serviceConfiguration).firstLossMinimum(
                    liquidityAsset
                ),
            "PoolFactory: Invalid first loss minimum"
        );
        require(
            settings.withdrawGateBps <= 10_000,
            "PoolFactory: Invalid withdraw gate"
        );
        require(
            settings.requestFeeBps <= 10_000,
            "PoolFactory: Invalid request fee"
        );

        // Create the pool
        Pool pool = new Pool(
            liquidityAsset,
            msg.sender,
            _serviceConfiguration,
            _withdrawControllerFactory,
            _poolControllerFactory,
            settings,
            "PerimeterPoolToken",
            "PPT"
        );

        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
