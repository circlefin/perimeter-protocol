// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/ILoanFactory.sol";
import "../Loan.sol";
import "../upgrades/BeaconProxyFactory.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title A factory that emits Loan contracts.
 * @dev Acts as a beacon contract, emitting beacon proxies and holding a reference
 * to their implementation contract.
 */
contract LoanFactory is ILoanFactory, BeaconProxyFactory {
    /**
     * @inheritdoc ILoanFactory
     */
    mapping(address => bool) public isLoan;

    /**
     * @dev A reference to the VaultFactory.
     */
    address internal _vaultFactory;

    /**
     * @dev Constructor for the LoanFactory.
     * @param serviceConfiguration Reference to the global service configuration.
     * @param vaultFactory Reference to a VaultFactory.
     */
    constructor(address serviceConfiguration, address vaultFactory) {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
        _vaultFactory = vaultFactory;
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
    ) public returns (address) {
        require(
            _serviceConfiguration.paused() == false,
            "LoanFactory: Protocol paused"
        );
        require(implementation != address(0), "LoanFactory: no implementation");
        address addr = initializeLoan(borrower, pool, liquidityAsset, settings);
        emit LoanCreated(addr);
        isLoan[addr] = true;
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
                _vaultFactory,
                settings
            )
        );
        return address(proxy);
    }
}
