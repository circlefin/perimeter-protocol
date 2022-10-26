// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Pool.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title PoolFactory
 */
contract PoolFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    IServiceConfiguration private _serviceConfiguration;

    /**
     * @dev Emitted when a pool is created.
     */
    event PoolCreated(address indexed addr);

    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
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
    ) public virtual returns (address poolAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "PoolFactory: Protocol paused"
        );
        require(
            withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );
        if (fixedFee > 0) {
            require(
                fixedFeeInterval > 0,
                "PoolFactory: Invalid fixed fee interval"
            );
        }

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
        Pool pool = new Pool(
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
