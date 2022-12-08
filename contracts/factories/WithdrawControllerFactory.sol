// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../controllers/WithdrawController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/IWithdrawControllerFactory.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title WithdrawController Factory
 */
contract WithdrawControllerFactory is
    IWithdrawControllerFactory,
    BeaconProxyFactory
{
    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
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
            _serviceConfiguration.paused() == false,
            "WithdrawControllerFactory: Protocol paused"
        );

        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(WithdrawController.initialize.selector, pool)
        );

        addr = address(proxy);
        emit WithdrawControllerCreated(addr);
    }
}
