// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IProtocolPermission.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
     * @dev Emitted when an address is added or removed from the allow list.
     */
    event AllowListUpdated(address indexed addr, bool isAllowed);

    /**
     * @dev Checks against an allowList to see if the given address is allowed.
     * See {IProtocolPermission-isAllowed}.
     */
    function isAllowed(address addr) external view returns (bool) {
        return _allowList[addr];
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
}
