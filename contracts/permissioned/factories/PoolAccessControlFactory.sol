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

import "./interfaces/IPoolAccessControlFactory.sol";
import "../interfaces/IPermissionedServiceConfiguration.sol";
import "../../factories/LoanFactory.sol";
import "../PoolAccessControl.sol";
import "../../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title PoolAccessControlFactory
 * @dev Allows permissioning of pool participants through trusted verifications of
 * Verite credentials or an allow list curated by the Pool Admin.
 */
contract PoolAccessControlFactory is
    IPoolAccessControlFactory,
    BeaconProxyFactory
{
    /**
     * @dev Constructor
     * @param serviceConfiguration Reference to the permissioned version
     * of the service configuration.
     */
    constructor(address serviceConfiguration) {
        _serviceConfiguration = IPermissionedServiceConfiguration(
            serviceConfiguration
        );
    }

    /**
     * @inheritdoc IPoolAccessControlFactory
     */
    function create(address pool) external virtual override returns (address) {
        require(
            implementation != address(0),
            "PoolAccessControlFactory: no impl"
        );
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                PoolAccessControl.initialize.selector,
                pool,
                _serviceConfiguration.tosAcceptanceRegistry()
            )
        );
        return address(proxy);
    }
}
