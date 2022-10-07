// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./IERC4626.sol";

/**
 * @title Data type storing collected accounting statistics
 */
struct IPoolAccountings {
    uint256 defaultsTotal;
    uint256 activeLoanPrincipals;
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

/**
 * @title The various configurable settings that customize Pool behavior.
 */
struct IPoolConfigurableSettings {
    uint256 maxCapacity; // amount
    uint256 endDate; // epoch seconds
    uint256 requestFeeBps; // bips
    uint256 firstLossInitialMinimum; // amount
    uint256 withdrawRequestPeriodDuration; // seconds (e.g. 30 days)
    // TODO: add in Pool fees
}

/**
 * @dev contains withdraw request information
 */
struct IPoolWithdrawState {
    uint256 requestedShares; // Number of shares requested in the `latestPeriod`
    uint256 eligibleShares; // Number of shares that are eligibble to be CONSIDERED for withdraw by the crank
    uint256 lastUpdatedPeriod; // Period where this was last updated
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
     * @dev Emitted when a withdrawal is requested.
     */
    event WithdrawRequested(address indexed lender, uint256 assets);

    /**
     * @dev Emitted when a redeem fee is paid.
     */
    event RequestFeePaid(address indexed lender, uint256 feeShares);

    /**
     * @dev Emitted when a redeem is requested.
     */
    event RedeemRequested(address indexed lender, uint256 shares);

    /**
     * @dev Emitted when pool settings are updated.
     */
    event PoolSettingsUpdated(IPoolConfigurableSettings settings);

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
     * @dev The manager for the pool.
     */
    function manager() external view returns (address);

    /**
     * @dev The amount of first loss available to the pool.
     */
    function firstLoss() external view returns (uint256);

    /**
     * @dev The pool accounting variables;
     */
    function accountings() external view returns (IPoolAccountings memory);

    /**
     * @dev Deposits first-loss to the pool. Can only be called by the Pool Manager.
     */
    function depositFirstLoss(uint256 amount, address spender) external;

    /**
     * @dev Withdraws first-loss from the pool. Can only be called by the Pool Manager.
     */
    function withdrawFirstLoss(uint256 amount, address receiver)
        external
        returns (uint256);

    /**
     * @dev Updates the pool capacity. Can only be called by the Pool Manager.
     */
    function updatePoolCapacity(uint256) external returns (uint256);

    /**
     * @dev Updates the pool end date. Can only be called by the Pool Manager.
     */
    function updatePoolEndDate(uint256) external returns (uint256);

    /**
     * @dev Returns the withdrawal fee for a given withdrawal amount at the current block.
     */
    function requestFee(uint256) external view returns (uint256);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdraw(uint256) external returns (uint256);

    /**
     * @dev Called by the pool manager, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address) external;

    /**
     * @dev Called by the pool manager, this marks a loan as in default, triggering liquiditation
     * proceedings and updating pool accounting.
     */
    function defaultLoan(address) external;
}
