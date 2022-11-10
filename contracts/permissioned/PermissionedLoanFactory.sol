// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAdminAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../interfaces/IPoolWithdrawManagerFactory.sol";
import "../LoanFactory.sol";
import "./PermissionedLoan.sol";

/**
 * @title PermissionedLoanFactory
 */
contract PermissionedLoanFactory is LoanFactory {
    constructor(address serviceConfiguration)
        LoanFactory(serviceConfiguration)
    {}

    /**
     * @inheritdoc LoanFactory
     */
    function createLoan(
        address borrower,
        address pool,
        address liquidityAsset,
        ILoanSettings memory settings
    ) public virtual override returns (address LoanAddress) {
        require(
            _serviceConfiguration.paused() == false,
            "LoanFactory: Protocol paused"
        );
        Loan loan = new PermissionedLoan(
            _serviceConfiguration,
            address(this),
            borrower,
            pool,
            liquidityAsset,
            settings
        );
        address addr = address(loan);
        emit LoanCreated(addr);
        _isLoan[addr] = true;
        return addr;
    }
}
