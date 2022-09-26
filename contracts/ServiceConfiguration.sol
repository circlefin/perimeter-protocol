// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./permissioned/interfaces/IPoolManagerAccessControl.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title The ServiceConfiguration contract
 * @dev Implementation of the {IServiceConfiguration} interface.
 */
contract ServiceConfiguration is AccessControl, IServiceConfiguration {
    /**
     * @dev The Operator Role
     */
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IPoolManagerAccessControl public _poolManagerAccessControl;

    /**
     * @dev Emitted when an address is changed.
     */
    event AddressSet(bytes32 which, address addr);

    /**
     * @dev Constructor for the contract, which sets up the default roles and
     * owners.
     */
    constructor() {
        // Grant the contract deployer the Operator role
        _setupRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @dev Modifier that checks that the caller account has the Operator role.
     */
    modifier onlyOperator() {
        require(
            hasRole(OPERATOR_ROLE, msg.sender),
            "ServiceConfiguration: caller is not an operator"
        );
        _;
    }

    /**
     * @dev Set the PoolManagerAccessControl contract.
     * @dev Emits `AddressSet` event.
     */
    function setPoolManagerAccessControl(
        IPoolManagerAccessControl poolManagerAccessControl
    ) public onlyOperator {
        _poolManagerAccessControl = poolManagerAccessControl;
        emit AddressSet(
            "POOL_MANAGER_PERMISSION",
            address(_poolManagerAccessControl)
        );
    }
}
