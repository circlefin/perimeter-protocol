// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The interface for controlling access to Pools
 */
interface IPoolAccessControl {
    /**
     * @dev Check if an address is allowed as a lender
     * @param addr The address to verify
     * @return whether the address is allowed as a lender
     */
    function isValidLender(address addr) external view returns (bool);

    /**
     * @dev Check if an address is allowed as a borrower
     * @param addr The address to verify
     * @return whether the address is allowed as a borrower
     */
    function isValidBorrower(address addr) external view returns (bool);
}
