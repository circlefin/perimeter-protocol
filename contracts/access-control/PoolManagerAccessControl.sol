// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerAccessControl.sol";
import "../interfaces/IVerificationRegistry.sol";
import "../ServiceConfigurable.sol";

/**
 * @title The PoolManagerAccessControl contract
 * @dev Implementation of the {IPoolManagerAccessControl} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the contract Operator role.
 */
contract PoolManagerAccessControl is
    ServiceConfigurable,
    IPoolManagerAccessControl
{
    /**
     * @dev A mapping of addresses to whether they are allowed as a Pool Manager
     */
    mapping(address => bool) private _allowList;

    /**
     * @dev The address of the Verification Registry which is used to determine
     * whether an address is allowed as a Pool Manager
     */
    address private _verificationRegistry;

    /**
     * @dev Emitted when an address is added or removed from the allow list.
     */
    event AllowListUpdated(address indexed addr, bool isAllowed);

    /**
     * @dev Emitted when a Verification Registry is set.
     */
    event VerificationRegistrySet(address addr);

    /**
     * @dev Emitted when a Verification Registry is removed.
     */
    event VerificationRegistryRemoved();

    /**
     * @dev Constructor for the contract, which sets the ServiceConfiguration.
     */
    constructor(address serviceConfiguration)
        ServiceConfigurable(serviceConfiguration)
    {}

    /**
     * @dev Checks if the given address is allowed as a Pool Manager.
     * @inheritdoc IPoolManagerAccessControl
     */
    function isAllowed(address addr) external view returns (bool) {
        if (_allowList[addr]) {
            return true;
        }

        if (address(_verificationRegistry) != address(0)) {
            return
                IVerificationRegistry(_verificationRegistry).isVerified(addr);
        }

        return false;
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

    /**
     * @dev Sets the Verification Registry to be used to determine whether an
     * address is allowed as a Pool Manager
     * @param registry The address of the Verification Registry to set
     *
     * Emits a {VerificationRegistryListUpdated} event.
     */
    function setVerificationRegistry(address registry) external onlyOperator {
        _verificationRegistry = registry;

        emit VerificationRegistrySet(registry);
    }

    /**
     * @dev Removes the Verification Registry, if one is set. This is equivalent
     * of disabling the use of a Verification Registry when checking if a Pool
     * Manager is allowed.
     *
     * Emits a {VerificationRegistryRemoved} event.
     */
    function removeVerificationRegistry() external onlyOperator {
        _verificationRegistry = address(0);

        emit VerificationRegistryRemoved();
    }
}
