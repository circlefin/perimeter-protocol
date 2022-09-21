// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Pool.sol";

/**
 * @title PoolFactory
 */
contract PoolFactory {

    /**
     * @dev Emitted when a pool is created.
     */
    event PoolCreated(address indexed addr);

    /**
     * @dev Creates a pool
     * @dev Emits `PoolCreated` event.
     */
    function createPool(
        address liquidityAsset,
        uint256 maxCapacity,
        uint256 endDate,
        uint256 withdrawalFee
    ) external returns (address poolAddress) {
        PoolConfigurableSettings memory settings = PoolConfigurableSettings(maxCapacity, endDate, withdrawalFee);
        Pool pool = new Pool(liquidityAsset, msg.sender, settings, "ValyriaPoolToken", "VPT");
        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }

}
