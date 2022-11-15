// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAdminAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../interfaces/IPoolWithdrawManagerFactory.sol";
import "../PoolFactory.sol";
import "./PermissionedPool.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory {
    /**
     * @dev Reference to the PermissionedServiceConfiguration contract
     */
    IPermissionedServiceConfiguration private _serviceConfiguration;

    constructor(address serviceConfiguration)
        PoolFactory(serviceConfiguration)
    {
        _serviceConfiguration = IPermissionedServiceConfiguration(
            serviceConfiguration
        );
    }

    /**
     * @dev Check that `msg.sender` is a PoolAdmin.
     */
    modifier onlyVerifiedPoolAdmin() {
        require(
            _serviceConfiguration.poolAdminAccessControl().isAllowed(
                msg.sender
            ),
            "caller is not allowed pool admin"
        );
        _;
    }

    /**
     * @inheritdoc PoolFactory
     */
    function createPool(
        address liquidityAsset,
        address poolWithdrawManagerFactory,
        IPoolConfigurableSettings calldata settings
    ) public override onlyVerifiedPoolAdmin returns (address poolAddress) {
        require(
            settings.withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );

        PermissionedPool pool = new PermissionedPool(
            address(this),
            liquidityAsset,
            msg.sender,
            address(_serviceConfiguration),
            settings,
            "PerimeterPoolToken",
            "PPT"
        );
        address addr = address(pool);

        // Create the pool's withdraw manager factory
        address poolWithdrawManager = IPoolWithdrawManagerFactory(
            poolWithdrawManagerFactory
        ).createPoolWithdrawManager(addr);

        // Set the pools withdraw manager
        pool.setWithdrawManager(poolWithdrawManager);

        emit PoolCreated(addr);
        return addr;
    }
}
