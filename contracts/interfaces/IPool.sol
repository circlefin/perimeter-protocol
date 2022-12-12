// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IERC4626.sol";
import "./IServiceConfiguration.sol";
import "../controllers/interfaces/IPoolController.sol";
import "../controllers/interfaces/IWithdrawController.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title Data type storing collected accounting statistics
 */
struct IPoolAccountings {
    uint256 outstandingLoanPrincipals;
    uint256 fixedFeeDueDate;
    uint256 totalAssetsDeposited;
    uint256 totalAssetsWithdrawn;
    uint256 totalDefaults;
    uint256 totalFirstLossApplied;
}

/**
 * @title The interface for liquidity pools.
 */
interface IPool is IERC4626 {
    /**
     * @dev Emitted when a loan is funded from the pool.
     */
    event LoanFunded(address indexed loan, uint256 amount);

    /**
     * @dev Emitted when a funded loan matures.
     */
    event LoanMatured(address indexed loan);

    /**
     * @dev Emitted when a redeem fee is paid.
     */
    event RequestFeePaid(address indexed lender, uint256 feeShares);

    /**
     * @dev Emitted when a withdrawal is requested.
     */
    event WithdrawRequested(
        address indexed lender,
        uint256 assets,
        uint256 shares
    );

    /**
     * @dev Emitted when a withdrawal is requested.
     */
    event WithdrawRequestCancelled(
        address indexed lender,
        uint256 assets,
        uint256 shares
    );

    /**
     * @dev Emitted when the pool is snapshotted for a given withdraw period.
     */
    event PoolSnapshotted(
        uint256 withDrawPeriod,
        uint256 redeemableShares,
        uint256 withdrawableAssets
    );

    /**
     * @dev The PoolController contract
     */
    function poolController() external view returns (IPoolController);

    /**
     * @dev The WithdrawController contract
     */
    function withdrawController() external view returns (IWithdrawController);

    /**
     * @dev The ServiceConfiguration.
     */
    function serviceConfiguration()
        external
        view
        returns (IServiceConfiguration);

    /**
     * @dev The current configurable pool settings.
     */
    function settings()
        external
        view
        returns (IPoolConfigurableSettings calldata settings);

    /**
     * @dev The current pool state.
     */
    function state() external view returns (IPoolLifeCycleState);

    /**
     * @dev The admin for the pool.
     */
    function admin() external view returns (address);

    /**
     * @dev The address of the fee vault.
     */
    function feeVault() external view returns (address);

    /**
     * @dev The first loss vault
     */
    function firstLossVault() external view returns (address);

    /**
     * @dev The pool accounting variables;
     */
    function accountings() external view returns (IPoolAccountings memory);

    /**
     * @dev The activation timestamp of the pool.
     */
    function activatedAt() external view returns (uint256);

    /**
     * @dev The pool fee, in bps, taken from each interest payment
     */
    function serviceFeeBps() external view returns (uint256);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestRedeem(uint256) external returns (uint256);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdraw(uint256) external returns (uint256);

    /**
     * @dev The sum of all assets available in the liquidity pool, excluding
     * any assets that are marked for withdrawal.
     */
    function liquidityPoolAssets() external view returns (uint256);

    /**
     * @dev Callback from the pool controller when the pool is activated
     */
    function onActivated() external;

    /**
     * @dev Snapshots the pool's withdrawals
     */
    function snapshot() external;

    /**
     * @dev Returns the set of currently Active loans.
     */
    function activeLoans() external view returns (address[] memory);

    /**
     * @dev Returns whether a loan is an active Pool loan.
     */
    function isActiveLoan(address addr) external view returns (bool);

    /**
     * @dev Returns whether a loan is an active Pool loan.
     */
    function numActiveLoans() external view returns (uint256);

    /**
     * @dev Fund a loan, add it to the funded loans list and increment the
     * outstanding principal balance. Only callable by the Pool Controller
     */
    function fundLoan(address) external;

    /**
     * @dev Called by a loan, it notifies the pool that the loan has returned
     * principal to the pool.
     */
    function onLoanPrincipalReturned(uint256 amount) external;

    /**
     * @dev Called by a loan, it notifies the pool that the loan has transitioned stated.
     */
    function onLoanStateTransitioned() external;

    /**
     * @dev Called by the PoolController, notifies the Pool that a loan has been defaulted.
     */
    function onLoanDefaulted(address loan, uint256 firstLossApplied) external;

    /**
     * @dev Called by the Pool Controller, it transfers the fixed fee
     */
    function claimFixedFee(
        address,
        uint256,
        uint256
    ) external;

    /**
     * @dev Calculate the total amount of underlying assets held by the vault,
     * excluding any assets due for withdrawal.
     */
    function totalAvailableAssets() external view returns (uint256);

    /**
     * @dev The total available supply that is not marked for withdrawal
     */
    function totalAvailableSupply() external view returns (uint256);

    /**
     * @dev The accrued interest at the current block.
     */
    function currentExpectedInterest() external view returns (uint256 interest);
}
