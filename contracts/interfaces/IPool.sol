// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./IERC4626.sol";
import "../controllers/interfaces/IPoolController.sol";
import "../controllers/interfaces/IWithdrawController.sol";

/**
 * @title Data type storing collected accounting statistics
 */
struct IPoolAccountings {
    uint256 defaultsTotal;
    uint256 outstandingLoanPrincipals;
    uint256 fixedFeeDueDate;
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
    uint256 crankOffsetPeriod; // At the time of request, this is set to the last successful crank.
}

/**
 * @dev Holds per-snapshot state used to compute a user's redeemable shares and assets.
 */
struct IPoolSnapshotState {
    uint256 aggregationSumRay;
    uint256 aggregationSumFxRay;
    uint256 aggregationDifferenceRay;
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
     * @dev Emitted when first loss capital is used to cover loan defaults
     */
    event FirstLossApplied(
        address indexed loan,
        uint256 amount,
        uint256 outstandingLoss
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
    function activatedAt() external view returns (uint256);

    /**
     * @dev The pool fee, in bps, taken from each interest payment
     */
    function poolFeePercentOfInterest() external view returns (uint256);

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
     * @dev Transfer `assets` to the first loss vault. Only accessible by the
     * Pool Admin via the PoolController.
     */
    function transferToFirstLossVault(address, uint256) external;

    /**
     * @dev Transfer `assets` from the first loss vault. Only accessible by the
     * Pool Admin via the PoolController.
     */
    function transferFromFirstLossVault(address, uint256) external;

    /**
     * @dev Cranks the pool's withdrawals
     */
    function crank() external returns (uint256);

    function totalAvailableAssets() external view returns (uint256);

    function totalAvailableSupply() external view returns (uint256);

    /**
     */
    function numFundedLoans() external view returns (uint256);

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
