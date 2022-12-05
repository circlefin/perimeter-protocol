// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../PoolFactory.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "./PermissionedPool.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory, IBeacon {
    /**
     * @dev Reference to a PoolAccessControlFactory
     */
    address private _poolAccessControlFactory;

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
        PermissionedPool pool = new PermissionedPool(
            liquidityAsset,
            msg.sender,
            address(_serviceConfiguration),
            _withdrawControllerFactory,
            _poolControllerFactory,
            _poolAccessControlFactory,
            settings,
            "PerimeterPoolToken",
            "PPT"
        );
        return address(pool);
    }
}
