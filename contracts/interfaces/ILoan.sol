// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IServiceConfiguration.sol";
import "../interfaces/IVault.sol";

/**
 * @title An enum capturing the various states a Loan may be in.
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

/**
 * @title The basic type of a loan.
 */
enum ILoanType {
    Fixed,
    Open
}

/**
 * @title A wrapper around NFT loan collateral.
 */
struct ILoanNonFungibleCollateral {
    address asset;
    uint256 tokenId;
}

/**
 * @title The various Loan terms.
 */
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

/**
 * @title The primary interface for Perimeter loans.
 */
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

    /**
     * @dev Current Loan lifecycle state.
     */
    function state() external view returns (ILoanLifeCycleState);

    /**
     * @dev The loan's borrower.
     */
    function borrower() external view returns (address);

    /**
     * @dev The pool associated with a loan.
     */
    function pool() external view returns (address);

    /**
     * @dev The factory that created the loan.
     */
    function factory() external view returns (address);

    /**
     * @dev A timestamp that controls when the loan can be dissolved and collateral returned.
     */
    function dropDeadTimestamp() external view returns (uint256);

    /**
     * @dev Cancels the loan if in a Requested state.
     */
    function cancelRequested() external returns (ILoanLifeCycleState);

    /**
     * @dev Cancels the loan if in a Collateralized state.
     */
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

    /**
     * @dev Complete the next payment according to loan schedule inclusive of all fees.
     */
    function completeNextPayment() external returns (uint256);

    /**
     * @dev Complete the final payment of the loan.
     */
    function completeFullPayment() external returns (uint256);

    /**
     * @dev Allows partial repayment of outstanding principal in open-term loans.
     */
    function paydownPrincipal(uint256 amount) external;

    /**
     * @dev Allows a pool admin to reclaim funds held in the funding vault.
     */
    function reclaimFunds(uint256 amount) external;

    /**
     * @dev Preview fees for a given interest payment amount.
     * @param amount allows previewing the fee for a full or prorated payment.
     */
    function previewFees(uint256 amount)
        external
        view
        returns (ILoanFees memory);

    /**
     * @dev Called by the borrower, this posts ERC20 assets to the collateral vault.
     */
    function postFungibleCollateral(address asset, uint256 amount)
        external
        returns (ILoanLifeCycleState);

    /**
     * @dev Returns the ERC20 collateral posted to the loan.
     */
    function fungibleCollateral() external view returns (address[] memory);

    /**
     * @dev Transfers and posts NFT collateral to be held by the loan's vault.
     */
    function postNonFungibleCollateral(address asset, uint256 tokenId)
        external
        returns (ILoanLifeCycleState);

    /**
     * @dev Returns NFT collateral posted to the loan.
     */
    function nonFungibleCollateral()
        external
        view
        returns (ILoanNonFungibleCollateral[] memory);

    /**
     * @dev Transfers out the collateral held by the loan. Can only be
     * called by the borrower or the Pool Admin under specific constraints.
     */
    function claimCollateral(
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external;

    /**
     * @dev Called by the Pool, this funds the loan with Pool liquidity.
     */
    function fund() external returns (ILoanLifeCycleState);

    /**
     * @dev Called by the borrower, this draws down the loans funds.
     * Fixed term loans can only drawdown the full loan amount.
     */
    function drawdown(uint256 amount) external returns (uint256);

    /**
     * @dev When the loan was created.
     */
    function createdAt() external returns (uint256);

    /**
     * @dev Duration of the loan, after which the principal must be returned.
     */
    function duration() external returns (uint256);

    /**
     * @dev The time between each loan interest payment.
     */
    function paymentPeriod() external view returns (uint256);

    /**
     * @dev Loan type configured for the loan. Either fixed or open term.
     */
    function loanType() external returns (ILoanType);

    /**
     * @dev Interest rate for the loan.
     */
    function apr() external returns (uint256);

    /**
     * @dev Amount of loan principal.
     */
    function principal() external returns (uint256);

    /**
     * @dev The amount of principal outstanding (drawn out of the loan) by the borrower.
     * In fixed term loans, this is equal to the principal.
     */
    function outstandingPrincipal() external view returns (uint256);

    /**
     * @dev Address of the loan's funding vault, which holds liquidity transferred from the pool.
     */
    function fundingVault() external returns (IVault);

    /**
     * @dev Called by the Pool, this triggers default proceedings on the loan.
     */
    function markDefaulted() external returns (ILoanLifeCycleState);

    /**
     * @dev Called by the PoolAdmin, this indicated that the open term loan
     * has been called back.
     */
    function markCallback() external;

    /**
     * @dev Liquidity asset of the loan or pool.
     */
    function liquidityAsset() external view returns (address);

    /**
     * @dev Address of the global service configuration.
     */
    function serviceConfiguration()
        external
        view
        returns (IServiceConfiguration);
}
