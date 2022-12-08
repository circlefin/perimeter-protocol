// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./Pool.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./interfaces/IPoolFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./upgrades/BeaconProxyFactory.sol";

/**
 * @title PoolFactory
 */
contract PoolFactory is IPoolFactory, BeaconProxyFactory {
    /**
     * @dev Reference to the WithdrawControllerFactory contract
     */
    address internal _withdrawControllerFactory;

    /**
     * @dev Reference to the PoolControllerFactory contract
     */
    address internal _poolControllerFactory;

    constructor(
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory
    ) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
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
            implementation != address(0),
            "PoolFactory: no implementation set"
        );
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
        require(
            settings.firstLossInitialMinimum >=
                _serviceConfiguration.firstLossMinimum(liquidityAsset),
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
        require(
            settings.requestCancellationFeeBps <= 10_000,
            "PoolFactory: Invalid request cancellation fee"
        );
        require(
            _serviceConfiguration.isLiquidityAsset(liquidityAsset),
            "PoolFactory: invalid asset"
        );

        // Create the pool
        address addr = initializePool(liquidityAsset, settings);
        emit PoolCreated(addr);
        return addr;
    }

    /**
     * @dev Creates the new Pool contract.
     */
    function initializePool(
        address liquidityAsset,
        IPoolConfigurableSettings calldata settings
    ) internal virtual returns (address) {
        // Create beacon proxy
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                Pool.initialize.selector,
                liquidityAsset,
                msg.sender,
                _serviceConfiguration,
                _withdrawControllerFactory,
                _poolControllerFactory,
                settings,
                "PerimeterPoolToken",
                "PPT"
            )
        );
        return address(proxy);
    }
}
