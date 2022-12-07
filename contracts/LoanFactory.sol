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
    IServiceConfiguration internal _serviceConfiguration;

    /**
     * @dev Mapping of created loans
     */
    mapping(address => bool) internal _isLoan;

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
        address liquidityAsset,
        ILoanSettings memory settings
    ) public returns (address LoanAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "LoanFactory: Protocol paused"
        );
        address addr = initializeLoan(borrower, pool, liquidityAsset, settings);
        emit LoanCreated(addr);
        _isLoan[addr] = true;
        return addr;
    }

    /**
     * @dev Internal initialization of Loan contract
     */
    function initializeLoan(
        address borrower,
        address pool,
        address liquidityAsset,
        ILoanSettings memory settings
    ) internal virtual returns (address) {
        Loan loan = new Loan(
            _serviceConfiguration,
            address(this),
            borrower,
            pool,
            liquidityAsset,
            settings
        );
        return address(loan);
    }

    /**
     * @dev Checks whether the address corresponds to a created loan for this factory
     */
    function isLoan(address loan) public view returns (bool) {
        return _isLoan[loan];
    }
}
