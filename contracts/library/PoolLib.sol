// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../PoolLifeCycleState.sol";
import "../interfaces/IPool.sol";

/**
 * @title Collection of functions used by the Pool
 */
library PoolLib {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 constant RAY = 10**27;

    /**
     * @dev See IPool for event definition.
     */
    event LifeCycleStateTransition(PoolLifeCycleState state);

    /**
     * @dev Emitted when first loss is supplied to the pool.
     */
    event FirstLossSupplied(address indexed supplier, uint256 amount);

    /**
     * @dev See IERC4626 for event definition.
     */
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /**
     * @dev Transfers first loss to the vault.
     * @param liquidityAsset Pool liquidity asset
     * @param amount Amount of first loss being contributed
     * @param currentState Lifecycle state of the pool
     * @param minFirstLossRequired The minimum amount of first loss the pool needs to become active
     * @return newState The updated Pool lifecycle state
     */
    function executeFirstLossContribution(
        address liquidityAsset,
        uint256 amount,
        address firstLossVault,
        PoolLifeCycleState currentState,
        uint256 minFirstLossRequired
    ) external returns (PoolLifeCycleState newState) {
        require(firstLossVault != address(0), "Pool: 0 address");

        IERC20(liquidityAsset).safeTransferFrom(
            msg.sender,
            firstLossVault,
            amount
        );
        newState = currentState;

        // Graduate pool state if needed
        if (
            currentState == PoolLifeCycleState.Initialized &&
            (amount >= minFirstLossRequired ||
                IERC20(liquidityAsset).balanceOf(address(firstLossVault)) >=
                minFirstLossRequired)
        ) {
            newState = PoolLifeCycleState.Active;
            emit LifeCycleStateTransition(newState);
        }
        emit FirstLossSupplied(msg.sender, amount);
    }

    /**
     * @dev Computes the exchange rate for converting assets to shares
     * @param assets Amount of assets to exchange
     * @param sharesTotalSupply Supply of Vault's ERC20 shares
     * @param nav Pool NAV
     * @return shares The amount of shares
     */
    function calculateAssetsToShares(
        uint256 assets,
        uint256 sharesTotalSupply,
        uint256 nav
    ) external pure returns (uint256 shares) {
        if (sharesTotalSupply == 0) {
            return assets;
        }

        // TODO: add in interest rate.
        uint256 rate = (sharesTotalSupply * RAY).div(nav);
        shares = (rate * assets).div(RAY);
    }

    /**
     * @dev Calculates the Pool Net Asset Value
     * @param totalVaultAssets Amount of total assets held by the Vault
     * @param defaultsTotal Total amount of defaulted loan amounts
     * @return nav Net Asset Value
     */
    function calculateNav(uint256 totalVaultAssets, uint256 defaultsTotal)
        external
        pure
        returns (uint256 nav)
    {
        // TODO: add in interest rate accruals
        nav = totalVaultAssets - defaultsTotal;
    }

    /**
     * @dev Calculates total assets held by Vault
     * @param asset Amount of total assets held by the Vault
     * @param vault Address of the ERC4626 vault
     * @param outstandingLoanPrincipals Sum of all oustanding loan principals
     * @return totalAssets Total assets
     */
    function calculateTotalAssets(
        address asset,
        address vault,
        uint256 outstandingLoanPrincipals
    ) external view returns (uint256 totalAssets) {
        totalAssets =
            IERC20(asset).balanceOf(vault) +
            outstandingLoanPrincipals;
    }

    /**
     * @dev Calculates the max deposit allowed in the pool
     * @param poolLifeCycleState The current pool lifecycle state
     * @param poolMaxCapacity Max pool capacity allowed per the pool settings
     * @param totalAssets Sum of all pool assets
     * @return Max deposit allowed
     */
    function calculateMaxDeposit(
        PoolLifeCycleState poolLifeCycleState,
        uint256 poolMaxCapacity,
        uint256 totalAssets
    ) external pure returns (uint256) {
        return
            poolLifeCycleState == PoolLifeCycleState.Active
                ? poolMaxCapacity - totalAssets
                : 0;
    }

    /**
     * @dev Executes a deposit into the pool
     * @param asset Pool liquidity asset
     * @param vault Address of ERC4626 vault
     * @param sharesReceiver Address of receiver of shares
     * @param assets Amount of assets being deposited
     * @param shares Amount of shares being minted
     * @param maxDeposit Max allowed deposit into the pool
     * @param mint A pointer to the mint function
     * @return The amount of shares being minted
     */
    function executeDeposit(
        address asset,
        address vault,
        address sharesReceiver,
        uint256 assets,
        uint256 shares,
        uint256 maxDeposit,
        function(address, uint256) mint
    ) internal returns (uint256) {
        require(shares > 0, "Pool: 0 deposit not allowed");
        require(assets <= maxDeposit, "Pool: Exceeds max deposit");

        IERC20(asset).safeTransferFrom(msg.sender, vault, assets);
        mint(sharesReceiver, shares);
        emit Deposit(msg.sender, sharesReceiver, assets, shares);
        return shares;
    }
}
