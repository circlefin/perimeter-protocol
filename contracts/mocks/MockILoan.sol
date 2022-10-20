// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/ILoan.sol";

/**
 * @dev Mock implementation of ILoan, used for testing.
 */
contract MockILoan is ILoan {
    ILoanLifeCycleState public state;
    address public borrower;
    address public pool;
    address public factory;
    uint256 public dropDeadTimestamp;
    uint256 public paymentsRemaining;
    uint256 public payment;
    uint256 public paymentDueDate;
    uint256 public createdAt;
    uint256 public duration;
    uint256 public paymentPeriod;
    ILoanType public loanType;
    uint256 public apr;
    uint256 public principal;
    FundingVault public fundingVault;

    function cancelRequested()
        external
        override
        returns (ILoanLifeCycleState)
    {}

    function cancelCollateralized()
        external
        override
        returns (ILoanLifeCycleState)
    {}

    function postFungibleCollateral(address asset, uint256 amount)
        external
        override
        returns (ILoanLifeCycleState)
    {}

    function fungibleCollateral()
        external
        view
        override
        returns (address[] memory)
    {}

    function postNonFungibleCollateral(address asset, uint256 tokenId)
        external
        override
        returns (ILoanLifeCycleState)
    {}

    function nonFungibleCollateral()
        external
        view
        override
        returns (ILoanNonFungibleCollateral[] memory)
    {}

    function fund() external override returns (ILoanLifeCycleState) {}

    function drawdown() external override returns (uint256) {}

    function markDefaulted() external override returns (ILoanLifeCycleState) {}

    function claimCollateral(
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external override {}

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
}
