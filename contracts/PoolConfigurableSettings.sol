// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The various configurable settings that customize Pool behavior.
 */
struct PoolConfigurableSettings {
    uint256 maxCapacity;
    uint256 endDate;
    uint256 withdrawalFee;
    // TODO: add in Pool fees
}
