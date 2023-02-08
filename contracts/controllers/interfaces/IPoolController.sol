// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../interfaces/IPool.sol";
import "../../interfaces/ILoan.sol";

/**
 * @dev Expresses the various states a pool can be in throughout its lifecycle.
 */
enum IPoolLifeCycleState {
    Initialized,
    Active,
    Closed
}

/**
 * @title The various configurable settings that customize Pool behavior.
 */
struct IPoolConfigurableSettings {
    uint256 maxCapacity; // amount
    uint256 endDate; // epoch seconds
    uint256 requestFeeBps; // bips
    uint256 requestCancellationFeeBps; // bips
    uint256 withdrawGateBps; // bips, percent of liquidity pool available to withdraw
    uint256 serviceFeeBps; // bips, percent taken from borrower payments to be paid to pool admin
    uint256 firstLossInitialMinimum; // amount of tokens to be deposited to first loss before a pool is active
    uint256 withdrawRequestPeriodDuration; // seconds (e.g. 30 days)
    uint256 fixedFee; // amount of tokens the pool admin can claim every interval
    uint256 fixedFeeInterval; // interval in days at which a pool admin can claim fixed fees from the pool
}

/**
 * @title A Pool's Admin controller
 * @dev Pool Admin's interact with the pool via the controller, including funding loans and adjusting
 * settings.
 */
interface IPoolController {
    /**
     * @dev Emitted when pool settings are updated.
     */
    event PoolSettingsUpdated();

    /**
     * @dev Emitted when the pool transitions a lifecycle state.
     */
    event LifeCycleStateTransition(IPoolLifeCycleState state);

    /**
     * @dev Emitted when a funded loan is marked as in default.
     */
    event LoanDefaulted(address indexed loan);

    /**
     * @dev Emitted when first loss is supplied to the pool.
     */
    event FirstLossDeposited(
        address indexed caller,
        address indexed spender,
        uint256 amount
    );

    /**
     * @dev Emitted when first loss is withdrawn from the pool.
     */
    event FirstLossWithdrawn(
        address indexed caller,
        address indexed receiver,
        uint256 amount
    );

    /**
     * @dev Emitted when first loss capital is used to cover loan defaults
     */
    event FirstLossApplied(address indexed loan, uint256 amount);

    /**
     * @dev The Pool's admin
     */
    function admin() external view returns (address);

    /*//////////////////////////////////////////////////////////////
                Settings
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev The current configurable pool settings.
     */
    function settings()
        external
        view
        returns (IPoolConfigurableSettings memory);

    /**
     * @dev Allow the current pool admin to update the service fee.
     */
    function setServiceFeeBps(uint256) external;

    /**
     * @dev Allow the current pool admin to update the fixed fee.
     */
    function setFixedFee(uint256 amount, uint256 interval) external;

    /**
     * @dev Allow the current pool admin to update the pool fees
     * before the pool has been activated.
     */
    function setRequestFee(uint256) external;

    /**
     * @dev Returns the redeem fee for a given withdrawal amount at the current block.
     * The fee is the number of shares that will be charged.
     */
    function requestFee(uint256) external view returns (uint256);

    /**
     * @dev Allow the current pool admin to update the pool cancellation fees
     * before the pool has been activated.
     */
    function setRequestCancellationFee(uint256) external;

    /**
     * @dev Returns the cancellation fee for a given withdrawal request at the
     * current block. The fee is the number of shares that will be charged.
     */
    function requestCancellationFee(uint256) external view returns (uint256);

    /**
     * @dev Allow the current pool admin to update the withdraw gate at any
     * time if the pool is Initialized or Active
     */
    function setWithdrawGate(uint256) external;

    /**
     * @dev Returns the current withdraw gate in bps. If the pool is closed,
     * this is set to 10_000 (100%)
     */
    function withdrawGate() external view returns (uint256);

    /**
     * @dev Returns the current withdraw request period duration in seconds. If the pool is closed,
     * this is lowered (if needed) to 1 day.
     */
    function withdrawRequestPeriodDuration() external view returns (uint256);

    /**
     * @dev Allow the current pool admin to update the pool capacity at any
     * time.
     */
    function setPoolCapacity(uint256) external;

    /**
     * @dev Allow the current pool admin to update the pool's end date. The end date can
     * only be moved earlier (but not in the past, as measured by the current block's timestamp).
     * Once the end date is reached, the Pool is closed.
     */
    function setPoolEndDate(uint256) external;

    /**
     * @dev The current amount of first loss available to the pool
     */
    function firstLossVault() external view returns (address);

    /**
     * @dev The current amount of first loss available to the pool
     */
    function firstLossBalance() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                State
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function state() external view returns (IPoolLifeCycleState);

    /**
     * @dev Returns true if the pool is in an active or initialized state
     */
    function isInitializedOrActive() external view returns (bool);

    /**
     * @dev Returns true if the pool is in an active or closed state
     */
    function isActiveOrClosed() external view returns (bool);

    /*//////////////////////////////////////////////////////////////
                First Loss
    //////////////////////////////////////////////////////////////*/

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

    /*//////////////////////////////////////////////////////////////
                Loans
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Called by the pool admin, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address) external;

    /**
     * @dev Called by the pool admin, this marks a loan as in default, triggering liquiditation
     * proceedings and updating pool accounting.
     */
    function defaultLoan(address) external;

    /**
     * @dev Called by the pool admin, this allows reclaiming loan principal funds back to the pool
     * from open-term loans.
     */
    function reclaimLoanFunds(address loan, uint256 amount) external;

    /**
     * @dev Called by the pool admin, this allows claiming loan collateral
     * back to the PA.
     */
    function claimLoanCollateral(
        address loan,
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external;

    /**
     * @dev Called by the pool admin, this cancels a funded loan.
     */
    function cancelFundedLoan(address loan) external;

    /*//////////////////////////////////////////////////////////////
                Fees
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Called by the pool admin, this claims a fixed fee from the pool. Fee can only be
     * claimed once every interval, as set on the pool.
     */
    function claimFixedFee() external;

    /**
     * @dev Called by the pool admin, this claims fees that have accumulated
     * in the Pool's FeeVault from ongoing borrower payments.
     */
    function withdrawFeeVault(uint256 amount, address receiver) external;

    /*//////////////////////////////////////////////////////////////
                Snapshot
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Snapshots the Pool, earmarking percentages of liquidity reserve for withdrawal.
     */
    function snapshot() external;
}
