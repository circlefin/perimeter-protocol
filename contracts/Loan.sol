// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";

/**
 * @title Loan
 *
 * Empty Loan contract.
 */
contract Loan is ILoan {
    ILoanLifeCycleState public state = ILoanLifeCycleState.Requested;
    address public immutable borrower;
    address public immutable pool;

    /**
     * @dev Modifier that requires the Loan be in the given `state_`
     */
    modifier atState(ILoanLifeCycleState state_) {
        require(
            state == state_,
            "Loan: FunctionInvalidAtThisILoanLifeCycleState"
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
            state != ILoanLifeCycleState.Canceled,
            "Loan: loan is in terminal state"
        );
        require(
            state != ILoanLifeCycleState.Defaulted,
            "Loan: loan is in terminal state"
        );
        require(
            state != ILoanLifeCycleState.Matured,
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
        atState(ILoanLifeCycleState.Requested)
        returns (ILoanLifeCycleState)
    {
        state = ILoanLifeCycleState.Canceled;
        return state;
    }

    /**
     * @dev Cancel the Loan and return any collateral
     */
    function cancelCollateralized()
        external
        onlyBorrower
        atState(ILoanLifeCycleState.Collateralized)
        returns (ILoanLifeCycleState)
    {
        // TODO: return collateral
        state = ILoanLifeCycleState.Canceled;
        return state;
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral()
        external
        onlyBorrower
        onlyActiveLoan
        onlyBorrower
        returns (ILoanLifeCycleState)
    {
        // TODO: post the collateral
        state = ILoanLifeCycleState.Collateralized;
        return state;
    }

    /**
     * @dev Post ERC721 tokens as collateral
     */
    function postNonFungibleCollateral()
        external
        onlyBorrower
        onlyActiveLoan
        onlyBorrower
        returns (ILoanLifeCycleState)
    {
        // TODO: post the collateral
        state = ILoanLifeCycleState.Collateralized;
        return state;
    }

    /**
     * @dev Fund the Loan
     * @dev Can only be called by the pool
     */
    function fund()
        external
        onlyPool
        atState(ILoanLifeCycleState.Collateralized)
        returns (ILoanLifeCycleState)
    {
        // TODO: fund the loan
        state = ILoanLifeCycleState.Funded;
        return state;
    }
}
