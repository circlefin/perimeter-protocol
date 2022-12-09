// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IServiceConfiguration.sol";
import "../interfaces/IVault.sol";

/**
 * @title The protocol Loan
 */
enum ILoanLifeCycleState {
    Requested,
    Collateralized,
    Canceled,
    Defaulted,
    Funded,
    Matured,
    Active,
    Callback
}

enum ILoanType {
    Fixed,
    Open
}

struct ILoanNonFungibleCollateral {
    address asset;
    uint256 tokenId;
}

struct ILoanSettings {
    ILoanType loanType;
    uint256 principal;
    uint256 apr;
    uint256 duration;
    uint256 paymentPeriod;
    uint256 dropDeadTimestamp;
    uint256 latePayment;
    uint256 originationBps;
}

struct ILoanFees {
    uint256 interestPayment; // interest payment transferred to pool
    uint256 firstLossFee; // deducted from interest payments and transferred to first loss vault
    uint256 serviceFee; // deducted from interest payments and transferred to fee vault
    uint256 originationFee; // additional payment on top of interest payments and transferred to fee vault
    uint256 latePaymentFee; // additional payment transferred to pool
    uint256 payment; // cached monthly payment by borrowers
}

interface ILoan {
    /**
     * @dev Emitted when loan is funded.
     */
    event LoanFunded(address asset, uint256 amount);

    /**
     * @dev Emitted when the loan is drawn down.
     */
    event LoanDrawnDown(address asset, uint256 amount);

    /**
     * @dev Emitted when a Loan's lifecycle state transitions
     */
    event LifeCycleStateTransition(ILoanLifeCycleState state);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedCollateral(address asset, uint256 amount);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedNonFungibleCollateral(address asset, uint256 tokenId);

    /**
     * @dev Emitted when collateral is withdrawn from the loan.
     */
    event WithdrewCollateral(address asset, uint256 amount);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event WithdrewNonFungibleCollateral(address asset, uint256 tokenId);

    /**
     * @dev Emitted when a loan is canceled and principal returned to the pool.
     */
    event CanceledLoanPrincipalReturned(
        address indexed pool,
        uint256 principal
    );

    function state() external view returns (ILoanLifeCycleState);

    function borrower() external view returns (address);

    function pool() external view returns (address);

    function factory() external view returns (address);

    function dropDeadTimestamp() external view returns (uint256);

    function cancelRequested() external returns (ILoanLifeCycleState);

    function cancelCollateralized() external returns (ILoanLifeCycleState);

    /**
     * @dev Allows borrower to PM to cancel a Funded loan, after the dropdead date.
     * This cancels a loan, allowing collateral to be returned and principal reclaimed to
     * the pool.
     */
    function cancelFunded() external returns (ILoanLifeCycleState);

    /**
     * @dev Number of payments remaining
     */
    function paymentsRemaining() external view returns (uint256);

    /**
     * @dev Amount expected in each payment
     */
    function payment() external view returns (uint256);

    /**
     * @dev Due date for the next payment
     */
    function paymentDueDate() external view returns (uint256);

    function postFungibleCollateral(address asset, uint256 amount)
        external
        returns (ILoanLifeCycleState);

    function fungibleCollateral() external view returns (address[] memory);

    function postNonFungibleCollateral(address asset, uint256 tokenId)
        external
        returns (ILoanLifeCycleState);

    function nonFungibleCollateral()
        external
        view
        returns (ILoanNonFungibleCollateral[] memory);

    function claimCollateral(
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external;

    function fund() external returns (ILoanLifeCycleState);

    function drawdown(uint256 amount) external returns (uint256);

    function createdAt() external returns (uint256);

    function duration() external returns (uint256);

    function paymentPeriod() external view returns (uint256);

    function loanType() external returns (ILoanType);

    function apr() external returns (uint256);

    function principal() external returns (uint256);

    function outstandingPrincipal() external view returns (uint256);

    function fundingVault() external returns (IVault);

    function markDefaulted() external returns (ILoanLifeCycleState);

    function markCallback() external;

    function liquidityAsset() external view returns (address);

    function serviceConfiguration()
        external
        view
        returns (IServiceConfiguration);
}
