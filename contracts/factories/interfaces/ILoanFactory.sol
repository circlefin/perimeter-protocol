// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../interfaces/ILoan.sol";

/**
 * @title Interface for the LoanFactory.
 */
interface ILoanFactory {
    /**
     * @dev Emitted when a loan is created.
     */
    event LoanCreated(address indexed addr);

    /**
     * @dev Creates a loan
     * @dev Emits `LoanCreated` event.
     */
    function createLoan(
        address borrower,
        address pool,
        address liquidityAsset,
        ILoanSettings memory settings
    ) external returns (address);

    /**
     * @dev Checks whether a Loan address was created by the factory.
     */
    function isLoan(address loan) external view returns (bool);
}
