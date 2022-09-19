// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title Expresses the various states a pool can be in throughout its lifecycle.
 */
enum PoolLifeCycleState {
    Initialized,
    Active,
    Paused,
    Closed
}
