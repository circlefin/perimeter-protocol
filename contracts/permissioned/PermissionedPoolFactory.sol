// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../PoolFactory.sol";

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
            "ServiceConfiguration: caller is not a pool manager"
        );
        _;
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool(
        address liquidityAsset,
        uint256 maxCapacity,
        uint256 endDate,
        uint256 withdrawalFee
    ) public override onlyVerifiedPoolManager returns (address poolAddress) {
        return
            super.createPool(
                liquidityAsset,
                maxCapacity,
                endDate,
                withdrawalFee
            );
    }
}
