// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

interface IProtocolPermission {
    /**
     * @dev Check if an address is allowed as a Pool Manager
     * @param addr The address to verify
     * @return whether the address is allowed as a Pool Manager
     */
    function isAllowed(address addr) external view returns (bool);
}
