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
    function createLoan() public virtual returns (address LoanAddress) {
        Loan Loan = new Loan();
        address addr = address(Loan);
        emit LoanCreated(addr);
        return addr;
    }
}
