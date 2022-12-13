// SPDX-License-Identifier: MIT
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
