// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerPermission.sol";
import "./PoolFactory.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory {

    IPoolManagerPermission private _permission;

    constructor(IPoolManagerPermission permission) {
        _permission = permission;
    }

    /**
     * @dev Check that `msg.sender` is a PoolManager.
     */
    modifier onlyPoolManager() {
        require(
            _permission.isAllowed(msg.sender),
            "PoolFactory: Not PM"
        );
        _;
    }

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool() override public onlyPoolManager returns (address poolAddress) {
        return super.createPool();
    }

}
