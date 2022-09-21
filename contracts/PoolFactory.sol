// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Pool.sol";
import "./ServiceConfigurable.sol";

/**
 * @title PoolFactory
 */
contract PoolFactory is ServiceConfigurable {
    /**
     * @dev Emitted when a pool is created.
     */
    event PoolCreated(address indexed addr);

    constructor(address serviceConfiguration)
        ServiceConfigurable(serviceConfiguration)
    {}

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool() public virtual returns (address poolAddress) {
        Pool pool = new Pool();
        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
