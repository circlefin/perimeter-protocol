// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title Interface for Beacon contracts.
 * @dev Holds a reference to the implementation, and allows setting new ones.
 */
interface IBeacon {
    /**
     * @dev Emitted when a new implementation is set.
     */
    event ImplementationSet(address indexed implementation);

    /**
     * @dev Returns an address used by BeaconProxy contracts for delegated calls.
     */
    function implementation() external view returns (address);

    /**
     * @dev Updates the implementation.
     */
    function setImplementation(address implementation) external;
}
