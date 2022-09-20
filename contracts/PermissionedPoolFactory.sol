// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerPermission.sol";
import "./PoolFactory.sol";
import "./ServiceConfiguration.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory {
    /**
     * @dev The Protocol ServiceConfiguration contract
     */
    ServiceConfiguration private _serviceConfiguration;

    constructor(ServiceConfiguration serviceConfiguration) {
        _serviceConfiguration = serviceConfiguration;
    }

    /**
     * @dev Check that `msg.sender` is a PoolManager.
     */
    modifier onlyPoolManager() {
        require(
            _serviceConfiguration._poolManagerPermission().isAllowed(
                msg.sender
            ),
            "PoolFactory: Not PM"
        );
        _;
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool()
        public
        override
        onlyPoolManager
        returns (address poolAddress)
    {
        return super.createPool();
    }
}
