// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IProtocolPermission.sol";
import "./interfaces/IVerificationRegistry.sol";

/**
 * @title The ProtocolPermission contract
 * @dev Implementation of the {IProtocolPermission} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the contract owner.
 */
contract ProtocolPermission is Ownable, IProtocolPermission {
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
    event VerificationRegistryListUpdated(address addr, bool isAllowed);

    /**
     * @dev Checks against an allowList to see if the given address is allowed.
     * @inheritdoc IProtocolPermission
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
     * @dev Adds or removes an address from the allowList.
     * @param addr The address to add or remove
     *
     * Emits an {AllowListUpdated} event.
     */
    function setAllowed(address addr, bool allow) external onlyOwner {
        _allowList[addr] = allow;

        emit AllowListUpdated(addr, allow);
    }

    /**
     * @dev Adds a Verification Registry to the list of registries used to
     * determine whether an address is allowed as a Pool Manager
     * @param registry The address of the Verification Registry to add
     *
     * Emits a {VerificationRegistryListUpdated} event.
     */
    function addVerificationRegistry(address registry) external onlyOwner {
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
    function removeVerificationRegistry(address registry) external onlyOwner {
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
