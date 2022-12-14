// SPDX-License-Identifier: MIT
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
