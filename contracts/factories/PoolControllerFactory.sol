// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../controllers/PoolController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../factories/interfaces/IPoolControllerFactory.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title PoolAdmin controller Factory
 */
contract PoolControllerFactory is IPoolControllerFactory, BeaconProxyFactory {
    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IPoolControllerFactory
     */
    function createController(
        address pool,
        address serviceConfiguration,
        address admin,
        address liquidityAsset,
        IPoolConfigurableSettings memory poolSettings
    ) public virtual returns (address addr) {
        require(
            _serviceConfiguration.paused() == false,
            "PoolControllerFactory: Protocol paused"
        );
        require(implementation != address(0), "PoolControllerFactory: no impl");

        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                PoolController.initialize.selector,
                pool,
                serviceConfiguration,
                admin,
                liquidityAsset,
                poolSettings
            )
        );
        addr = address(proxy);
        emit PoolControllerCreated(addr, admin);
    }
}
