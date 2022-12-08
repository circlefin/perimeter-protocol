// SPDX-License-Identifier: MIT
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
