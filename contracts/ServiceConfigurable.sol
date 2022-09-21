// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./ServiceConfiguration.sol";

/**
 * @title Service Configurable
 * @dev Adds modifiers and access methods to contracts in the protocol which
 * require ServiceConfiguration
 */
abstract contract ServiceConfigurable {
    /**
     * @dev The Protocol ServiceConfiguration contract
     */
    ServiceConfiguration private _serviceConfiguration;

    /**
     * @dev Constructor for the contract, which sets the ServiceConfiguration.
     */
    constructor(address serviceConfiguration) {
        _serviceConfiguration = ServiceConfiguration(serviceConfiguration);
    }

    /**
     * @dev Check that `msg.sender` is a PoolManager.
     */
    modifier onlyPoolManager() {
        require(
            _serviceConfiguration._poolManagerPermission().isAllowed(
                msg.sender
            ),
            "ServiceConfiguration: caller is not a pool manager"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the caller account has the Operator role.
     */
    modifier onlyOperator() {
        require(
            _serviceConfiguration.hasRole(
                _serviceConfiguration.OPERATOR_ROLE(),
                msg.sender
            ),
            "ServiceConfiguration: caller is not an operator"
        );
        _;
    }
}
