// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/IServiceConfiguration.sol";
import "./interfaces/ILoanFactory.sol";
import "./Loan.sol";
import "./upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title LoanFactory
 */
contract LoanFactory is ILoanFactory, BeaconProxyFactory {
    /**
     * @dev Mapping of created loans
     */
    mapping(address => bool) internal _isLoan;

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
        require(implementation != address(0), "LoanFactory: no implementation");
        address addr = initializeLoan(borrower, pool, liquidityAsset, settings);
        emit LoanCreated(addr);
        _isLoan[addr] = true;
        return addr;
    }

    /**
     * @dev Internal initialization of Beacon proxy for Loans
     */
    function initializeLoan(
        address borrower,
        address pool,
        address liquidityAsset,
        ILoanSettings memory settings
    ) internal virtual returns (address) {
        BeaconProxy proxy = new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                Loan.initialize.selector,
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

    /**
     * @dev Checks whether the address corresponds to a created loan for this factory
     */
    function isLoan(address loan) public view returns (bool) {
        return _isLoan[loan];
    }
}
