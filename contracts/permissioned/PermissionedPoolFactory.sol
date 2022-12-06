// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../interfaces/IPoolFactory.sol";
import "./PermissionedPool.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is IPoolFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    address private _serviceConfiguration;

    /**
     * @dev Reference to a PoolAccessControlFactory
     */
    address private _poolAccessControlFactory;

    /**
     * @dev Reference to the WithdrawControllerFactory contract
     */
    address private _withdrawControllerFactory;

    /**
     * @dev Reference to the PoolControllerFactory contract
     */
    address private _poolControllerFactory;

    constructor(
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory,
        address poolAccessControlFactory
    ) {
        _serviceConfiguration = serviceConfiguration;
        _withdrawControllerFactory = withdrawControllerFactory;
        _poolControllerFactory = poolControllerFactory;
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

    /**
     * @inheritdoc IPoolFactory
     */
    function createPool(
        address liquidityAsset,
        IPoolConfigurableSettings calldata settings
    ) public override onlyVerifiedPoolAdmin returns (address poolAddress) {
        require(
            IServiceConfiguration(_serviceConfiguration).paused() == false,
            "PoolFactory: Protocol paused"
        );
        require(
            settings.withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );

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
        address addr = address(pool);

        emit PoolCreated(addr);
        return addr;
    }
}
