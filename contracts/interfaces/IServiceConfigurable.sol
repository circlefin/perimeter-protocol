// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IServiceConfigurable
 * @dev Interface indicating that the contract is controlled by the protocol service configuration.
 */
interface IServiceConfigurable {
    /**
     * @dev Address of the protocol service configuration.
     */
    function serviceConfiguration() external view returns (address);
}
