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

import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/IVaultFactory.sol";
import "../upgrades/BeaconProxyFactory.sol";
import "../Vault.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title A factory that emits Vault contracts.
 * @dev Acts as a beacon contract, emitting beacon proxies and holding a reference
 * to their implementation contract.
 */
contract VaultFactory is IVaultFactory, BeaconProxyFactory {
    /**
     * @dev Constructor
     * @param serviceConfiguration Reference to the global service configuration.
     */
    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IVaultFactory
     */
    function createVault(address owner) public override returns (address addr) {
        require(
            implementation != address(0),
            "VaultFactory: no implementation set"
        );
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                Vault.initialize.selector,
                owner,
                _serviceConfiguration
            )
        );
        address proxyAddr = address(proxy);
        emit VaultCreated(proxyAddr);
        return proxyAddr;
    }
}
