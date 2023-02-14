// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../controllers/WithdrawController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/IWithdrawControllerFactory.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title Factory that emits WithdrawControllers.
 * @dev Acts as a beacon contract, emitting beacon proxies and holding a reference
 * to their implementation contract.
 */
contract WithdrawControllerFactory is
    IWithdrawControllerFactory,
    BeaconProxyFactory
{
    /**
     * @dev Constructor
     * @param serviceConfiguration Reference to the global service configuration.
     */
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
        require(
            implementation != address(0),
            "WithdrawControllerFactory: no impl"
        );

        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(WithdrawController.initialize.selector, pool)
        );

        addr = address(proxy);
        emit WithdrawControllerCreated(addr);
    }
}
