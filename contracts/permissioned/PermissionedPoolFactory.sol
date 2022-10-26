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
            "caller is not a pool manager"
        );
        _;
    }

    /**
     * @inheritdoc PoolFactory
     */
    function createPool(
        address liquidityAsset,
        uint256 maxCapacity,
        uint256 endDate,
        uint256 requestFeeBps,
        uint256 withdrawGateBps,
        uint256 withdrawRequestPeriodDuration,
        uint256 fixedFee,
        uint256 fixedFeeInterval,
        uint256 poolFeePercentOfInterest
    ) public override onlyVerifiedPoolManager returns (address poolAddress) {
        require(
            withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );

        uint256 firstLossInitialMinimum = 0; // TODO: take from ServiceConfig

        IPoolConfigurableSettings memory settings = IPoolConfigurableSettings(
            maxCapacity,
            endDate,
            requestFeeBps,
            withdrawGateBps,
            firstLossInitialMinimum,
            withdrawRequestPeriodDuration,
            fixedFee,
            fixedFeeInterval,
            0,
            poolFeePercentOfInterest
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
