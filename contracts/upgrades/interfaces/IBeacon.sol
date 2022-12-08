// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IBeacon
 * @dev Interface of Beacon contracts.
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
