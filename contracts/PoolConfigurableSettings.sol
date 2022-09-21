// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The various configurable settings that customize Pool behavior.
 */
struct PoolConfigurableSettings {
    uint256 maxCapacity; // amount
    uint256 endDate; // epoch seconds
    uint256 withdrawalFee; // bips
    uint256 firstLossInitialMinimum; // amount
    // TODO: add in Pool fees
}
