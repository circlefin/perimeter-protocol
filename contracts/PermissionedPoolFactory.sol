// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerAccessControl.sol";
import "./PoolFactory.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is PoolFactory {
    constructor(address serviceConfiguration)
        PoolFactory(serviceConfiguration)
    {}

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool(
        address liquidityAsset,
        uint256 maxCapacity,
        uint256 endDate,
        uint256 withdrawalFee
    ) public override onlyPoolManager returns (address poolAddress) {
        return
            super.createPool(
                liquidityAsset,
                maxCapacity,
                endDate,
                withdrawalFee
            );
    }
}
