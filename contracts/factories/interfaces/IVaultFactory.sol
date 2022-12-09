// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title The interface for controlling access to Pools
 */
interface IVaultFactory {
    /**
     * @dev Emitted when a vault is created.
     */
    event VaultCreated(address indexed owner);

    /**
     * @dev Creates a new vault.
     */
    function createVault(address owner) external returns (address);
}
