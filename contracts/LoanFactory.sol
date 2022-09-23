// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./Loan.sol";
import "./ServiceConfigurable.sol";

/**
 * @title LoanFactory
 */
contract LoanFactory is ServiceConfigurable {
    /**
     * @dev Emitted when a Loan is created.
     */
    event LoanCreated(address indexed addr);

    constructor(address serviceConfiguration)
        ServiceConfigurable(serviceConfiguration)
    {}

    /**
     * @dev Creates a Loan
     * @dev Emits `LoanCreated` event.
     */
    function createLoan(address pool)
        public
        virtual
        returns (address LoanAddress)
    {
        Loan loan = new Loan(msg.sender, pool);
        address addr = address(loan);
        emit LoanCreated(addr);
        return addr;
    }
}
