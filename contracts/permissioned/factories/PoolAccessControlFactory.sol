// SPDX-License-Identifier: MIT
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
