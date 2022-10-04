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
    function createLoan(
        address borrower,
        address pool,
        uint256 dropDeadDate
    ) public virtual returns (address LoanAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "LoanFactory: Protocol paused"
        );
        Loan loan = new Loan(borrower, pool, dropDeadDate);
        address addr = address(loan);
        emit LoanCreated(addr);
        return addr;
    }
}
