// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./IERC4626.sol";

/**
 * @title Data type storing collected accounting statistics
 */
struct IPoolAccountings {
    uint256 defaultsTotal;
    uint256 outstandingLoanPrincipals;
    uint256 fixedFeeDueDate;
}

/**
 * @title Expresses the various states a pool can be in throughout its lifecycle.
 */
enum IPoolLifeCycleState {
    Initialized,
    Active,
    Paused,
    Closed
}

struct IPoolSnapshotState {
    uint256 redeemableRateRay;
    uint256 fxRateRayAssetsOverShares;
}

/**
 * @title The various configurable settings that customize Pool behavior.
 */
struct IPoolConfigurableSettings {
    uint256 maxCapacity; // amount
    uint256 endDate; // epoch seconds
    uint256 requestFeeBps; // bips
    uint256 requestCancellationFeeBps; // bips
    uint256 withdrawGateBps; // Percent of liquidity pool available to withdraw, represented in BPS
    uint256 firstLossInitialMinimum; // amount
    uint256 withdrawRequestPeriodDuration; // seconds (e.g. 30 days)
    uint256 fixedFee;
    uint256 fixedFeeInterval;
    uint256 poolFeePercentOfInterest; // bips
}

/**
 * @dev contains withdraw request information
 */
struct IPoolWithdrawState {
    uint256 requestedShares; // Number of shares requested in the `latestPeriod`
    uint256 eligibleShares; // Number of shares that are eligibble to be CONSIDERED for withdraw by the crank
    uint256 latestRequestPeriod; // Period where this was last updated
    uint256 redeemableShares; // The shares that are currently withdrawable
    uint256 withdrawableAssets; // The assets that are currently withdrawable
    uint256 latestCrankPeriod; // window last cranked in
}

/**
 * @title The interface for liquidity pools.
 */
interface IPool is IERC4626 {
    /**
     * @dev Emitted when the pool transitions a lifecycle state.
     */
    event LifeCycleStateTransition(IPoolLifeCycleState state);

    /**
     * @dev Emitted when a loan is funded from the pool.
     */
    event LoanFunded(address indexed loan, uint256 amount);

    /**
     * @dev Emitted when a funded loan is marked as in default.
     */
    event LoanDefaulted(address indexed loan);

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
     * @dev Emitted when pool settings are updated.
     */
    event PoolSettingsUpdated();

    /**
     * @dev Emitted when first loss capital is used to cover loan defaults
     */
    event FirstLossApplied(
        address indexed loan,
        uint256 amount,
        uint256 outstandingLoss
    );

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function lifeCycleState() external view returns (IPoolLifeCycleState);

    /**
     * @dev The current configurable pool settings.
     */
    function settings()
        external
        view
        returns (IPoolConfigurableSettings memory settings);

    /**
     * @dev Returns the current withdraw gate in bps. If the pool is closed,
     * this is set to 10_000 (100%)
     */
    function withdrawGate() external view returns (uint256);

    /**
     * @dev The admin for the pool.
     */
    function admin() external view returns (address);

    /**
     * @dev The amount of first loss available to the pool.
     */
    function firstLoss() external view returns (uint256);

    /**
     * @dev The address of the first loss vault.
     */
    function firstLossVault() external view returns (address);

    /**
     * @dev The address of the fee vault.
     */
    function feeVault() external view returns (address);

    /**
     * @dev The pool accounting variables;
     */
    function accountings() external view returns (IPoolAccountings memory);

    /**
     * @dev The activation timestamp of the pool.
     */
    function poolActivatedAt() external view returns (uint256);

    /**
     * @dev The pool fee, in bps, taken from each interest payment
     */
    function poolFeePercentOfInterest() external view returns (uint256);

    /**
     * @dev Deposits first-loss to the pool. Can only be called by the Pool Admin.
     */
    function depositFirstLoss(uint256 amount, address spender) external;

    /**
     * @dev Withdraws first-loss from the pool. Can only be called by the Pool Admin.
     */
    function withdrawFirstLoss(uint256 amount, address receiver)
        external
        returns (uint256);

    /**
     * @dev Updates the pool capacity. Can only be called by the Pool Admin.
     */
    function updatePoolCapacity(uint256) external;

    /**
     * @dev Updates the pool end date. Can only be called by the Pool Admin.
     */
    function updatePoolEndDate(uint256) external;

    /**
     * @dev Returns the withdrawal fee for a given withdrawal amount at the current block.
     */
    function requestFee(uint256) external view returns (uint256);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestRedeem(uint256) external returns (uint256);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdraw(uint256) external returns (uint256);

    /**
     * @dev Cranks the pool's withdrawals
     */
    function crank() external returns (uint256);

    /**
     * @dev The sum of all assets available in the liquidity pool, excluding
     * any assets that are marked for withdrawal.
     */
    function liquidityPoolAssets() external view returns (uint256);

    /**
     * @dev Called by the pool admin, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address) external;

    /**
     * @dev Called by a loan, it notifies the pool that the loan has returned principal
     * to the pool.
     */
    function notifyLoanPrincipalReturned() external;

    /**
     * @dev Called by the pool admin, this marks a loan as in default, triggering liquiditation
     * proceedings and updating pool accounting.
     */
    function defaultLoan(address) external;

    /**
     * @dev Called by the pool admin, this claims a fixed fee from the pool. Fee can only be
     * claimed once every interval, as set on the pool.
     */
    function claimFixedFee() external;
}
