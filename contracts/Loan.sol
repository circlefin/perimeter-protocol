// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./library/LoanLib.sol";
import "./CollateralVault.sol";

/**
 * @title Loan
 *
 * Empty Loan contract.
 */
contract Loan is ILoan {
    ILoanLifeCycleState private _state = ILoanLifeCycleState.Requested;
    address private immutable _borrower;
    address private immutable _pool;
    CollateralVault public immutable _collateralVault;
    address[] private _fungibleCollateral;
    ILoanNonFungibleCollateral[] private _nonFungibleCollateral;

    /**
     * @dev Modifier that requires the Loan be in the given `state_`
     */
    modifier atState(ILoanLifeCycleState state) {
        require(
            _state == state,
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

    constructor(address borrower, address pool) {
        _borrower = borrower;
        _pool = pool;
        _collateralVault = new CollateralVault(address(this));
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
        _state = LoanLib.withdrawFungibleCollateral(
            _collateralVault,
            _state,
            _fungibleCollateral
        );
        _state = LoanLib.withdrawNonFungibleCollateral(
            _collateralVault,
            _state,
            _nonFungibleCollateral
        );

        return _state;
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral(address asset, uint256 amount)
        external
        onlyBorrower
        onlyActiveLoan
        returns (ILoanLifeCycleState)
    {
        _state = LoanLib.postFungibleCollateral(
            address(_collateralVault),
            asset,
            amount,
            _state,
            _fungibleCollateral
        );
        return _state;
    }

    function fungibleCollateral() external view returns (address[] memory) {
        return _fungibleCollateral;
    }

    /**
     * @dev Post ERC721 tokens as collateral
     */
    function postNonFungibleCollateral(address asset, uint256 tokenId)
        external
        onlyBorrower
        onlyActiveLoan
        returns (ILoanLifeCycleState)
    {
        _state = LoanLib.postNonFungibleCollateral(
            address(_collateralVault),
            asset,
            tokenId,
            _state,
            _nonFungibleCollateral
        );
        return _state;
    }

    function nonFungibleCollateral()
        external
        view
        returns (ILoanNonFungibleCollateral[] memory)
    {
        return _nonFungibleCollateral;
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
