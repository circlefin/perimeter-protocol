/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.16;

import "../interfaces/IPermissionedServiceConfiguration.sol";
import "../../factories/LoanFactory.sol";
import "../PermissionedLoan.sol";

/**
 * @title Permissioned version of the LoanFactory
 * @dev Emits PermissionLoans. Also acts as a beacon for said proxies.
 */
contract PermissionedLoanFactory is LoanFactory {
    constructor(
        address serviceConfiguration,
        address vaultFactory
    ) LoanFactory(serviceConfiguration, vaultFactory) {}

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
                _vaultFactory,
                settings
            )
        );
        return address(proxy);
    }
}
