// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/ILoan.sol";

/**
 * @dev Mock implementation of a Loan
 */
contract MockILoan {
    uint256 public paymentsRemaining;
    uint256 public payment;
    uint256 public paymentDueDate;
    uint256 public paymentPeriod;
    uint256 public principal;
    ILoanLifeCycleState public state;

    // Setters for mocked values
    function setPrincipal(uint256 principal_) external {
        principal = principal_;
    }

    function setPayment(uint256 payment_) external {
        payment = payment_;
    }

    function setPaymentPeriod(uint256 paymentPeriod_) external {
        paymentPeriod = paymentPeriod_;
    }

    function setPaymentDueDate(uint256 paymentDueDate_) external {
        paymentDueDate = paymentDueDate_;
    }

    function setPaymentsRemaining(uint256 paymentsRemaining_) external {
        paymentsRemaining = paymentsRemaining_;
    }

    function setState(ILoanLifeCycleState state_) external {
        state = state_;
    }
}
