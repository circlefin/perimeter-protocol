// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title An interface for a factory that creates PoolAccessControl contracts.
 */
interface IPoolAccessControlFactory {
    /**
     * @dev Creates a new PoolAccessControl.
     */
    function create(address pool) external returns (address);
}
