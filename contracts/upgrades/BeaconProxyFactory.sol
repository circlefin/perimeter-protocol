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
import "./interfaces/IBeacon.sol";

/**
 * @title Factory for emitting beacon proxies.
 * @dev Base contract for emitting new Beacon proxy contracts. Allows setting new
 * implementations by the global deployer.
 */
abstract contract BeaconProxyFactory is IBeacon {
    /**
     * @dev Address of the protocol service configuration
     */
    IServiceConfiguration internal _serviceConfiguration;

    /**
     * @dev Modifier that requires that the sender is registered as a protocol deployer.
     */
    modifier onlyDeployer() {
        require(
            _serviceConfiguration.isDeployer(msg.sender),
            "Upgrade: unauthorized"
        );
        _;
    }

    /**
     * @inheritdoc IBeacon
     */
    address public implementation;

    /**
     * @inheritdoc IBeacon
     */
    function setImplementation(
        address newImplementation
    ) external onlyDeployer {
        implementation = newImplementation;
        emit ImplementationSet(newImplementation);
    }
}
