// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/IPermissionedServiceConfiguration.sol";
import "../../factories/PoolFactory.sol";
import "../PermissionedPool.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title Permissioned Version of the PoolFactory
 * @dev Emits PermissionedPools as Beacon Proxies. Also acts as a beacon for said proxies.
 */
contract PermissionedPoolFactory is PoolFactory {
    /**
     * @dev Reference to a PoolAccessControlFactory
     */
    address private _poolAccessControlFactory;

    /**
     * @dev Check that `msg.sender` is a PoolAdmin.
     */
    modifier onlyVerifiedPoolAdmin() {
        require(
            IPermissionedServiceConfiguration(address(_serviceConfiguration))
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
        address vaultFactory,
        address poolAccessControlFactory
    )
        PoolFactory(
            serviceConfiguration,
            withdrawControllerFactory,
            poolControllerFactory,
            vaultFactory
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
                _vaultFactory,
                _poolAccessControlFactory,
                settings,
                "PerimeterPoolToken",
                "PPT"
            )
        );
        return address(proxy);
    }
}
