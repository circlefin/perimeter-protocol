/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
