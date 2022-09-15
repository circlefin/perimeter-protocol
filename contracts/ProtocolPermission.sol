// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IProtocolPermission.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
     * @dev Adds an address to the allowList.
     * @param addr The address to add to the allowList
     *
     * Emits an {AllowListAdded} event.
     */
    function addToAllowList(address addr) external onlyOwner {
        _allowList[addr] = true;
        emit AllowListUpdated(addr, true);
    }

    /**
     * @dev Removes an address from the allowList.
     * @param addr The address to remove from the allowList
     *
     * Emits an {AllowListRemoved} event.
     */
    function removeFromAllowList(address addr) external onlyOwner {
        delete _allowList[addr];
        emit AllowListUpdated(addr, false);
    }

    /**
     * @dev Checks against an allowList to see if the given address is allowed.
     * See {IProtocolPermission-isAllowed}.
     */
    function isAllowed(address addr) external view returns (bool) {
        return _allowList[addr];
    }
}
