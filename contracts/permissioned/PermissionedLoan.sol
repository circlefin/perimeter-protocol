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

import "../Loan.sol";
import "./interfaces/IPoolAccessControl.sol";
import "./PoolAccessControl.sol";
import "./PermissionedPool.sol";

/**
 * @title Permission version of Loan.
 * @dev Enforces access control prior to select borrower actions.
 */
contract PermissionedLoan is Loan {
    /**
     * @dev The reference to the access control contract
     */
    IPoolAccessControl public poolAccessControl;

    /**
     * @dev a modifier to only allow valid borrowers to perform an action
     */
    modifier onlyPermittedBorrower() override {
        require(
            poolAccessControl.isAllowed(msg.sender),
            "BORROWER_NOT_ALLOWED"
        );
        _;
    }

    function initialize(
        address serviceConfiguration,
        address factory_,
        address borrower_,
        address pool_,
        address liquidityAsset_,
        address vaultFactory,
        ILoanSettings memory settings_
    ) public override {
        super.initialize(
            serviceConfiguration,
            factory_,
            borrower_,
            pool_,
            liquidityAsset_,
            vaultFactory,
            settings_
        );
        poolAccessControl = PermissionedPool(pool_).poolAccessControl();
    }
}
