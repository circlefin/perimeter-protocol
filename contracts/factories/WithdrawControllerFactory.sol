// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../controllers/WithdrawController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/IWithdrawControllerFactory.sol";

/**
 * @title WithdrawController Factory
 */
contract WithdrawControllerFactory is IWithdrawControllerFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    address private _serviceConfiguration;

    constructor(address serviceConfiguration) {
        _serviceConfiguration = serviceConfiguration;
    }

    /**
     * @inheritdoc IWithdrawControllerFactory
     */
    function createController(address pool)
        public
        virtual
        returns (address addr)
    {
        require(
            IServiceConfiguration(_serviceConfiguration).paused() == false,
            "WithdrawControllerFactory: Protocol paused"
        );

        WithdrawController withdrawController = new WithdrawController(pool);
        addr = address(withdrawController);
        emit WithdrawControllerCreated(addr);
    }
}
