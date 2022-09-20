// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./IERC4626.sol";
import "../PoolLifeCycleState.sol";
import "../PoolWithdrawalPeriod.sol";
import "../PoolConfigurableSettings.sol";

/**
 * @title The interface for liquidity pools.
 */
interface IPool {
    /**
     * @dev Emitted when the pool transitions a lifecycle state.
     */
    event LifeCycleStateTransition(PoolLifeCycleState state);

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
     * @dev Emitted when first loss is supplied to the pool.
     */
    event FirstLossProvided(address indexed supplier, uint256 amount);

    /**
     * @dev Emitted when a withdrawal is requested.
     */
    event WithdrawalRequested(address indexed lender, uint256 amount);

    /**
     * @dev Emitted when pool settings are updated.
     */
    event PoolSettingsUpdated(PoolConfigurableSettings settings);

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function lifeCycleState() external view returns (PoolLifeCycleState);

    /**
     * @dev The current configurable pool settings.
     */
    function poolSettings()
        external
        view
        returns (PoolConfigurableSettings memory settings);

    /**
     * @dev The manager for the pool.
     */
    function manager() external view returns (address);

    /**
     * @dev The amount of first loss available to the pool.
     */
    function firstLoss() external view returns (uint256);

    /**
     * @dev Updates the pool capacity. Can only be called by the PM.
     */
    function updatePoolCapacity(uint256) external returns (uint256);

    /**
     * @dev Updates the pool end date. Can only be called by the PM.
     */
    function updatePoolEndDate(uint256) external returns (uint256);

    /**
     * @dev Returns the withdrawal fee for a given withdrawal amount at the current block.
     */
    function feeForWithdrawalRequest(uint256) external view returns (uint256);

    /**
     * @dev Returns the next withdrawal window, at which a withdrawal could be completed.
     */
    function nextWithdrawalWindow(uint256)
        external
        view
        returns (PoolWithdrawalPeriod memory);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdrawal(uint256) external view;

    /**
     * @dev Called by the pool manager, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address) external;

    /**
     * @dev Called by the pool manager, marks a loan as in default, updating pool accounting and allowing loan
     * collateral to be claimed.
     */
    function markLoanAsInDefault(address) external;
}
