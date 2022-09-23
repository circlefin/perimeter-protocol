// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";

/**
 * @title Loan
 *
 * Empty Loan contract.
 */
contract Loan is ILoan {
    ILoanLifeCycleState private _state = ILoanLifeCycleState.Requested;
    address private immutable _borrower;
    address private immutable _pool;

    /**
     * @dev Modifier that requires the Loan be in the given `state_`
     */
    modifier atState(ILoanLifeCycleState state_) {
        require(
            _state == state_,
            "Loan: FunctionInvalidAtThisILoanLifeCycleState"
        );
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` to be the pool. Loan assumes the pool has performed access checks
     */
    modifier onlyPool() {
        require(msg.sender == _pool, "Loan: caller is not pool");
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` be the borrower.
     */
    modifier onlyBorrower() {
        require(msg.sender == _borrower, "Loan: caller is not borrower");
        _;
    }

    /**
     * @dev Modifier that requires the loan not be in a terminal state.
     */
    modifier onlyActiveLoan() {
        require(
            _state != ILoanLifeCycleState.Canceled,
            "Loan: loan is in terminal state"
        );
        require(
            _state != ILoanLifeCycleState.Defaulted,
            "Loan: loan is in terminal state"
        );
        require(
            _state != ILoanLifeCycleState.Matured,
            "Loan: loan is in terminal state"
        );
        _;
    }

    constructor(address borrower_, address pool_) {
        _borrower = borrower_;
        _pool = pool_;
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
        _state = ILoanLifeCycleState.Canceled;
        return _state;
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
        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral()
        external
        onlyBorrower
        onlyActiveLoan
        returns (ILoanLifeCycleState)
    {
        // TODO: post the collateral
        _state = ILoanLifeCycleState.Collateralized;
        return _state;
    }

    /**
     * @dev Post ERC721 tokens as collateral
     */
    function postNonFungibleCollateral()
        external
        onlyBorrower
        onlyActiveLoan
        returns (ILoanLifeCycleState)
    {
        // TODO: post the collateral
        _state = ILoanLifeCycleState.Collateralized;
        return _state;
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
        _state = ILoanLifeCycleState.Funded;
        return _state;
    }

    function state() external view returns (ILoanLifeCycleState) {
        return _state;
    }

    function borrower() external view returns (address) {
        return _borrower;
    }

    function pool() external view returns (address) {
        return _pool;
    }
}
