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

import "../controllers/WithdrawController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/IWithdrawControllerFactory.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title Factory that emits WithdrawControllers.
 * @dev Acts as a beacon contract, emitting beacon proxies and holding a reference
 * to their implementation contract.
 */
contract WithdrawControllerFactory is
    IWithdrawControllerFactory,
    BeaconProxyFactory
{
    /**
     * @dev Constructor
     * @param serviceConfiguration Reference to the global service configuration.
     */
    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IWithdrawControllerFactory
     */
    function createController(
        address pool
    ) public virtual returns (address addr) {
        require(
            _serviceConfiguration.paused() == false,
            "WithdrawControllerFactory: Protocol paused"
        );
        require(
            implementation != address(0),
            "WithdrawControllerFactory: no impl"
        );

        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(WithdrawController.initialize.selector, pool)
        );

        addr = address(proxy);
        emit WithdrawControllerCreated(addr);
    }
}
