// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../PoolFactory.sol";
import "../upgrades/IBeacon.sol";
import "./PermissionedPool.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory, IBeacon {
    /**
     * @dev Reference to a PoolAccessControlFactory
     */
    address private _poolAccessControlFactory;

    constructor(
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory,
        address poolAccessControlFactory
    )
        PoolFactory(
            serviceConfiguration,
            withdrawControllerFactory,
            poolControllerFactory
        )
    {
        _poolAccessControlFactory = poolAccessControlFactory;
    }

    /**
     * @dev Check that `msg.sender` is a PoolAdmin.
     */
    modifier onlyVerifiedPoolAdmin() {
        require(
            IPermissionedServiceConfiguration(_serviceConfiguration)
                .poolAdminAccessControl()
                .isAllowed(msg.sender),
            "CALLER_NOT_ADMIN"
        );
        _;
    }

    constructor(
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory,
        address poolAccessControlFactory
    )
        PoolFactory(
            serviceConfiguration,
            withdrawControllerFactory,
            poolControllerFactory
        )
    {
        _poolAccessControlFactory = poolAccessControlFactory;
    }

    /**
     * @inheritdoc PoolFactory
     * @dev Restricts callers to verified PoolAdmins
     */
    function createPool(
        address liquidityAsset,
        IPoolConfigurableSettings calldata settings
    ) public override onlyVerifiedPoolAdmin returns (address) {
        return super.createPool(liquidityAsset, settings);
    }

    /**
     * @inheritdoc PoolFactory
     * @dev Injects access control into the PermissionedPool
     */
    function initializePool(
        address liquidityAsset,
        IPoolConfigurableSettings calldata settings
    ) internal override returns (address) {
        // Create beacon proxy
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                PermissionedPool.initialize.selector,
                liquidityAsset,
                msg.sender,
                _serviceConfiguration,
                _withdrawControllerFactory,
                _poolControllerFactory,
                _poolAccessControlFactory,
                settings,
                "PerimeterPoolToken",
                "PPT"
            )
        );
        return address(proxy);
    }
}
