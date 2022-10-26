// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
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
     * @dev Check that `msg.sender` is a PoolManager.
     */
    modifier onlyVerifiedPoolManager() {
        require(
            _serviceConfiguration.poolManagerAccessControl().isAllowed(
                msg.sender
            ),
            "caller is not allowed pool manager"
        );
        _;
    }

    /**
     * @inheritdoc PoolFactory
     */
    function createPool(
        address liquidityAsset,
        IPoolConfigurableSettings calldata settings
    ) public override onlyVerifiedPoolManager returns (address poolAddress) {
        require(
            settings.withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );

        PermissionedPool pool = new PermissionedPool(
            liquidityAsset,
            msg.sender,
            address(_serviceConfiguration),
            settings,
            "ValyriaPoolToken",
            "VPT"
        );
        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
