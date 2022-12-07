// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPermissionedServiceConfiguration.sol";
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
     * @dev Deploys BeaconProxy for PermissionedLoan
     */
    function initializeLoan(
        address borrower,
        address pool,
        address liquidityAsset,
        ILoanSettings memory settings
    ) internal override returns (address) {
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                PermissionedLoan.initialize.selector,
                address(_serviceConfiguration),
                address(this),
                borrower,
                pool,
                liquidityAsset,
                settings
            )
        );
        return address(proxy);
    }
}
