// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerPermission.sol";
import "./PoolFactory.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory {

    IPoolManagerPermission private _permission;

    constructor(address permission) {
        _permission = IPoolManagerPermission(permission);
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool() override public returns (address poolAddress) {
        require(_permission.isAllowed(msg.sender), "Not allowed");
        return super.createPool();
    }

}
