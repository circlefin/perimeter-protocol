// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./PoolWithdrawManager.sol";
import "./interfaces/IPoolWithdrawManagerFactory.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title PoolWithdrawManager Factory
 */
contract PoolWithdrawManagerFactory is IPoolWithdrawManagerFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    IServiceConfiguration private _serviceConfiguration;

    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IPoolWithdrawManagerFactory
     */
    function createPoolWithdrawManager(address pool)
        public
        virtual
        returns (address addr)
    {
        require(
            _serviceConfiguration.paused() == false,
            "PoolWithdrawManagerFactory: Protocol paused"
        );

        PoolWithdrawManager poolWithdrawManager = new PoolWithdrawManager(pool);
        addr = address(poolWithdrawManager);
        emit PoolWithdrawManagerCreated(addr);
    }
}
