// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../library/PoolLib.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PoolLibTestWrapper
 * @dev Wrapper around PoolLib to facilitate testing.
 */
contract PoolLibTestWrapper is ERC20("PoolLibTest", "PLT") {
    event LifeCycleStateTransition(PoolLifeCycleState state);
    event FirstLossSupplied(address indexed supplier, uint256 amount);
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

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

    function calculateAssetsToShares(
        uint256 assets,
        uint256 sharesTotalSupply,
        uint256 nav
    ) external pure returns (uint256) {
        return PoolLib.calculateAssetsToShares(assets, sharesTotalSupply, nav);
    }

    function calculateNav(uint256 totalVaultAssets, uint256 defaultsTotal)
        external
        pure
        returns (uint256)
    {
        return PoolLib.calculateNav(totalVaultAssets, defaultsTotal);
    }

    function calculateTotalAssets(
        address asset,
        address vault,
        uint256 outstandingLoanPrincipals
    ) external view returns (uint256) {
        return
            PoolLib.calculateTotalAssets(
                asset,
                vault,
                outstandingLoanPrincipals
            );
    }

    function calculateMaxDeposit(
        PoolLifeCycleState poolLifeCycleState,
        uint256 poolMaxCapacity,
        uint256 totalAssets
    ) external pure returns (uint256) {
        return
            PoolLib.calculateMaxDeposit(
                poolLifeCycleState,
                poolMaxCapacity,
                totalAssets
            );
    }

    function executeDeposit(
        address asset,
        address vault,
        address sharesReceiver,
        uint256 assets,
        uint256 shares,
        uint256 maxDeposit
    ) external returns (uint256) {
        return
            PoolLib.executeDeposit(
                asset,
                vault,
                sharesReceiver,
                assets,
                shares,
                maxDeposit,
                _mint
            );
    }
}
