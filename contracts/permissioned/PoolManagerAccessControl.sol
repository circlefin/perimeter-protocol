// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";

/**
 * @title The PoolManagerAccessControl contract
 * @dev Implementation of the {IPoolManagerAccessControl} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the contract owner.
 */
contract PoolManagerAccessControl is IPoolManagerAccessControl {
    /**
     * @dev Reference to the PermissionedServiceConfiguration contract
     */
    IPermissionedServiceConfiguration private _serviceConfiguration;

    /**
     * @dev A mapping of addresses to whether they are allowed as a Pool Manager
     */
    mapping(address => bool) private _allowList;

    /**
     * @dev Emitted when an address is added or removed from the allow list.
     */
    event AllowListUpdated(address indexed addr, bool isAllowed);

    /**
     * @dev Modifier that checks that the caller account has the Operator role.
     */
    modifier onlyOperator() {
        require(
            _serviceConfiguration.isOperator(msg.sender),
            "caller is not an operator"
        );
        _;
    }

    /**
     * @dev Constructor for the contract, which sets the ServiceConfiguration.
     */
    constructor(address serviceConfiguration) {
        _serviceConfiguration = IPermissionedServiceConfiguration(
            serviceConfiguration
        );
    }

    /**
     * @dev Checks against an allowList to see if the given address is allowed.
     * @inheritdoc IPoolManagerAccessControl
     */
    function isAllowed(address addr) external view returns (bool) {
        return _allowList[addr];
    }

    /**
     * @dev Adds an address to the allowList.
     * @param addr The address to add
     *
     * Emits an {AllowListUpdated} event.
     */
    function allow(address addr) external onlyOperator {
        _allowList[addr] = true;

        emit AllowListUpdated(addr, true);
    }

    /**
     * @dev Removes an address from the allowList.
     * @param addr The address to remove
     *
     * Emits an {AllowListUpdated} event.
     */
    function remove(address addr) external onlyOperator {
        delete _allowList[addr];

        emit AllowListUpdated(addr, false);
    }
}
