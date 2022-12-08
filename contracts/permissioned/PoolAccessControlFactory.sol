// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAccessControlFactory.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../LoanFactory.sol";
import "./PoolAccessControl.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title PoolAccessControlFactory
 */
contract PoolAccessControlFactory is
    IPoolAccessControlFactory,
    BeaconProxyFactory
{
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
