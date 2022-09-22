// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";

/**
 * @title Loan
 *
 * Empty Loan contract.
 */
contract Loan is ILoan {
    enum LoanLifecycleState {
        Requested,
        Collateralized,
        Canceled,
        Defaulted,
        Funded,
        Matured
    }

    LoanLifecycleState public state = LoanLifecycleState.Requested;
    address public immutable borrower;
    address public immutable pool;

    /**
     * @dev Modifier that requires the Loan be in the given `state_`
     */
    modifier atLoanLifecycleState(LoanLifecycleState state_) {
        require(
            state == state_,
            "Loan: FunctionInvalidAtThisLoanLifecycleState"
        );
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` to be the pool. Loan assumes the pool has performed access checks
     */
    modifier onlyPool() {
        require(msg.sender == pool, "Loan: caller is not pool");
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` be the borrower.
     */
    modifier onlyBorrower() {
        require(msg.sender == borrower, "Loan: caller is not borrower");
        _;
    }

    /**
     * @dev Modifier that requires the loan not be in a terminal state.
     */
    modifier onlyActiveLoan() {
        require(
            state != LoanLifecycleState.Canceled,
            "Loan: loan is in terminal state"
        );
        require(
            state != LoanLifecycleState.Defaulted,
            "Loan: loan is in terminal state"
        );
        require(
            state != LoanLifecycleState.Matured,
            "Loan: loan is in terminal state"
        );
        _;
    }

    constructor(address borrower_, address pool_) {
        borrower = borrower_;
        pool = pool_;
    }

    /**
     * @dev Cancel the Loan
     */
    function cancelRequested()
        external
        onlyBorrower
        atLoanLifecycleState(LoanLifecycleState.Requested)
    {
        state = LoanLifecycleState.Canceled;
    }

    /**
     * @dev Cancel the Loan and return any collateral
     */
    function cancelCollateralized()
        external
        onlyBorrower
        atLoanLifecycleState(LoanLifecycleState.Collateralized)
    {
        // TODO: return collateral
        state = LoanLifecycleState.Canceled;
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral()
        external
        onlyBorrower
        onlyActiveLoan
        onlyBorrower
    {
        // TODO: post the collateral
        state = LoanLifecycleState.Collateralized;
    }

    /**
     * @dev Post ERC721 tokens as collateral
     */
    function postNonFungibleCollateral()
        external
        onlyBorrower
        onlyActiveLoan
        onlyBorrower
    {
        // TODO: post the collateral
        state = LoanLifecycleState.Collateralized;
    }

    /**
     * @dev Fund the Loan
     * @dev Can only be called by the pool
     */
    function fund()
        external
        onlyPool
        atLoanLifecycleState(LoanLifecycleState.Collateralized)
        returns (LoanLifecycleState)
    {
        // TODO: fund the loan
        state = LoanLifecycleState.Funded;
        return state;
    }
}
