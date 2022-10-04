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
    // Validate loan
    // valid collateral -- can't really do this
    // valid fundings
    // payment interval > 0
    // term of loan mod payment interval == 0
    // requested amount is > 0
    function createLoan(
        address borrower,
        address pool,
        uint256 duration,
        uint256 paymentPeriod,
        uint256 apr,
        uint256 dropDeadDate
    ) public virtual returns (address LoanAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "LoanFactory: Protocol paused"
        );
        Loan loan = new Loan(
            borrower,
            pool,
            duration,
            paymentPeriod,
            apr,
            dropDeadDate
        );
        address addr = address(loan);
        emit LoanCreated(addr);
        return addr;
    }
}
