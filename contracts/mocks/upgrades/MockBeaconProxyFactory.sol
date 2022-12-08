// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../../upgrades/BeaconProxyFactory.sol";
import "../../interfaces/IServiceConfiguration.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./MockBeaconImplementation.sol";

contract MockBeaconProxyFactory is BeaconProxyFactory {
    event Created(address proxy);

    constructor(address serviceConfig) {
        _serviceConfiguration = IServiceConfiguration(serviceConfig);
    }

    function create() external returns (address) {
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(MockBeaconImplementation.initialize.selector)
        );
        emit Created(address(proxy));
        return address(proxy);
    }
}
