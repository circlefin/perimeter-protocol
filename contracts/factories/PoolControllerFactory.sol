/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.16;

import "../controllers/PoolController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../factories/interfaces/IPoolControllerFactory.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title A factory that emits PoolController contracts.
 * @dev Acts as a beacon contract, emitting beacon proxies and holding a reference
 * to their implementation contract.
 */
contract PoolControllerFactory is IPoolControllerFactory, BeaconProxyFactory {
    /**
     * @dev Constructor
     * @param serviceConfiguration Reference to the global service configuration.
     */
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
        address vaultFactory,
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
                vaultFactory,
                poolSettings
            )
        );
        addr = address(proxy);
        emit PoolControllerCreated(addr, admin);
    }
}
