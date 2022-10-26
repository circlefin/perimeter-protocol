// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Loan.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title LoanFactory
 */
contract LoanFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    IServiceConfiguration private _serviceConfiguration;

    /**
     * @dev Mapping of created loans
     */
    mapping(address => bool) private _isLoan;

    /**
     * @dev Emitted when a Loan is created.
     */
    event LoanCreated(address indexed addr);

    constructor(address serviceConfiguration) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @dev Creates a Loan
     * @dev Emits `LoanCreated` event.
     */
    function createLoan(
        address borrower,
        address pool,
        uint256 duration,
        uint256 paymentPeriod,
        ILoanType loanType,
        uint256 apr,
        address liquidityAsset,
        uint256 principal,
        uint256 dropDeadDate,
        uint256 latePaymentFee
    ) public virtual returns (address LoanAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "LoanFactory: Protocol paused"
        );
        Loan loan = new Loan(
            _serviceConfiguration,
            address(this),
            borrower,
            pool,
            duration,
            paymentPeriod,
            loanType,
            apr,
            liquidityAsset,
            principal,
            dropDeadDate,
            latePaymentFee
        );
        address addr = address(loan);
        emit LoanCreated(addr);
        _isLoan[addr] = true;
        return addr;
    }

    /**
     * @dev Checks whether the address corresponds to a created loan for this factory
     */
    function isLoan(address loan) public view returns (bool) {
        return _isLoan[loan];
    }
}
