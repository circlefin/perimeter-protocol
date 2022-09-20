// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IPoolManagerPermission.sol";
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

    IPoolManagerPermission public _poolManagerPermission;

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
            hasRole(
                OPERATOR_ROLE,
                msg.sender
            ),
            "ServiceConfiguration: caller is not an operator"
        );
        _;
    }

    function setPoolManagerPermission(IPoolManagerPermission poolManagerPermission) public onlyOperator {
        _poolManagerPermission = poolManagerPermission;
    }
}
