// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IOwnable
 * @dev Interface type corresponding to OpenZeppelin's Ownable abstract type.
 */
interface IOwnable {
    /**
     * @dev Owner of contract.
     */
    function owner() external view returns (address);

    /**
     * @dev Renounces ownership over the contract.
     */
    function renounceOwnership() external;

    /**
     * @dev Transfers ownership of the contract to a new account owner.
     */
    function transferOwnership(address newOwner) external;
}
