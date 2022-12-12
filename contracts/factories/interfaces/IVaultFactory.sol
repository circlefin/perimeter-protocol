// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IVaultFactory
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
