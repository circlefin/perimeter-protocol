// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title The interface for controlling permissions for Pool Admins
 */
interface IPoolAdminAccessControl {
    /**
     * @dev Check if an address is allowed as a Pool Admin
     * @param addr The address to verify
     * @return whether the address is allowed as a Pool Admin
     */
    function isAllowed(address addr) external view returns (bool);
}
