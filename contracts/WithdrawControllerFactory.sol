// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./controllers/WithdrawController.sol";
import "./interfaces/IWithdrawControllerFactory.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title WithdrawController Factory
 */
contract WithdrawControllerFactory is IWithdrawControllerFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    IServiceConfiguration private _serviceConfiguration;

    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IWithdrawControllerFactory
     */
    function createWithdrawController(address pool)
        public
        virtual
        returns (address addr)
    {
        require(
            _serviceConfiguration.paused() == false,
            "WithdrawControllerFactory: Protocol paused"
        );

        WithdrawController withdrawController = new WithdrawController(pool);
        addr = address(withdrawController);
        emit WithdrawControllerCreated(addr);
    }
}
