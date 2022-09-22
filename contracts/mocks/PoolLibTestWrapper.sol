// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../library/PoolLib.sol";

/**
 * @title PoolLibTestWrapper
 * @dev Wrapper around PoolLib to facilitate testing.
 */
contract PoolLibTestWrapper {
    function executeFirstLossContribution(
        address liquidityAsset,
        uint256 amount,
        address firstLossVault,
        PoolLifeCycleState currentState,
        uint256 minFirstLossRequired
    ) external {
        PoolLib.executeFirstLossContribution(
            liquidityAsset,
            amount,
            firstLossVault,
            currentState,
            minFirstLossRequired
        );
    }
}
