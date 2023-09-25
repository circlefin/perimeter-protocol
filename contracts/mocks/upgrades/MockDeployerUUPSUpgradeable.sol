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

import "../../upgrades/DeployerUUPSUpgradeable.sol";
import "../../interfaces/IServiceConfiguration.sol";

contract DeployerUUPSUpgradeableMock is DeployerUUPSUpgradeable {
    function foo() external pure virtual returns (string memory) {
        return "bar";
    }

    function initialize(address serviceConfiguration) public initializer {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }
}

contract DeployerUUPSUpgradeableMockV2 is DeployerUUPSUpgradeableMock {
    function foo() external pure override returns (string memory) {
        return "baz";
    }
}
