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

import "../../upgrades/BeaconProxyFactory.sol";
import "../../interfaces/IServiceConfiguration.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./MockBeaconImplementation.sol";

contract MockBeaconProxyFactory is BeaconProxyFactory {
    event Created(address proxy);

    constructor(address serviceConfig) {
        _serviceConfiguration = IServiceConfiguration(serviceConfig);
    }

    function create() external returns (address) {
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(MockBeaconImplementation.initialize.selector)
        );
        emit Created(address(proxy));
        return address(proxy);
    }
}
