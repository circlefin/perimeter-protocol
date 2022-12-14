// SPDX-License-Identifier: MIT
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
    function setImplementation(address newImplementation)
        external
        onlyDeployer
    {
        implementation = newImplementation;
        emit ImplementationSet(newImplementation);
    }
}
