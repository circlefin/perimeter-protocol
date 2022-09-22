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
    function createPool(
        address liquidityAsset,
        uint256 maxCapacity,
        uint256 endDate,
        uint256 withdrawalFee
    ) public virtual returns (address poolAddress) {
        uint256 firstLossInitialMinimum = 0; // TODO: take from ServiceConfig
        PoolConfigurableSettings memory settings = PoolConfigurableSettings(
            maxCapacity,
            endDate,
            withdrawalFee,
            firstLossInitialMinimum
        );
        Pool pool = new Pool(
            liquidityAsset,
            msg.sender,
            settings,
            "ValyriaPoolToken",
            "VPT"
        );
        address addr = address(pool);
        emit PoolCreated(addr);
        return addr;
    }
}
