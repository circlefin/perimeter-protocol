// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerPermission.sol";
import "./interfaces/IVerificationRegistry.sol";

/**
 * @title The PoolManagerPermission contract
 * @dev Implementation of the {IPoolManagerPermission} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the contract owner.
 */
contract PoolManagerPermission is IPoolManagerPermission {
    /**
     * @dev The Protocol ServiceConfiguration contract
     */
    address private _serviceConfiguration;

    /**
     * @dev A mapping of addresses to whether they are allowed as a Pool Manager
     */
    mapping(address => bool) private _allowList;

    /**
     * @dev An array of Verification Registries which are used to determine
     * whether an address is allowed as a Pool Manager
     */
    address[] private _verificationRegistries;

    /**
     * @dev Emitted when an address is added or removed from the allow list.
     */
    event AllowListUpdated(address indexed addr, bool isAllowed);

    /**
     * @dev Emitted when a Verification Registry is added or removed.
     */
    event VerificationRegistryListUpdated(address addr, bool isAdded);

    /**
     * @dev Emitted when a Verification is performed
     */
    event VerificationPerformed(address addr, bool isAllowed);

    /**
     * @dev Modifier that checks that the caller account has the Operator role.
     * NOTE: This is stubbed out temporarily.
     */
    modifier onlyOperator() {
        _;
    }

    /**
     * @dev Checks against an allowList to see if the given address is allowed.
     * @inheritdoc IPoolManagerPermission
     */
    function isAllowed(address addr) external view returns (bool) {
        if (_allowList[addr]) {
            return true;
        }

        for (uint256 i = 0; i < _verificationRegistries.length; i++) {
            if (
                IVerificationRegistry(_verificationRegistries[i]).isVerified(
                    addr
                )
            ) {
                return true;
            }
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
     * @dev Adds a Verification Registry to the list of registries used to
     * determine whether an address is allowed as a Pool Manager
     * @param registry The address of the Verification Registry to add
     *
     * Emits a {VerificationRegistryListUpdated} event.
     */
    function addVerificationRegistry(address registry) external onlyOperator {
        _verificationRegistries.push(registry);

        emit VerificationRegistryListUpdated(registry, true);
    }

    /**
     * @dev Removes a Verification Registry from the list of registries used to
     * determine whether an address is allowed as a Pool Manager
     * @param registry The address of the Verification Registry to remove
     *
     * Emits a {VerificationRegistryListUpdated} event.
     */
    function removeVerificationRegistry(address registry)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < _verificationRegistries.length; i++) {
            if (_verificationRegistries[i] == registry) {
                // Remove the item from the array
                _verificationRegistries[i] = _verificationRegistries[
                    _verificationRegistries.length - 1
                ];
                _verificationRegistries.pop();

                emit VerificationRegistryListUpdated(registry, false);
                return;
            }
        }
    }
}
