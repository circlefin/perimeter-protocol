// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../Loan.sol";
import "./interfaces/IPoolAccessControl.sol";
import "./PoolAccessControl.sol";
import "./PermissionedPool.sol";

/**
 * @title PermissionedLoan
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

    /**
     * @dev The constructor for the PermissionedLoan contract. It holds a reference
     * to the corresponding PermissionedPool's access control contract to enforce the
     * same controls on borrowers.
     */
    constructor(
        IServiceConfiguration serviceConfiguration,
        address factory,
        address borrower,
        address pool,
        address liquidityAsset_,
        ILoanSettings memory settings_
    )
        Loan(
            serviceConfiguration,
            factory,
            borrower,
            pool,
            liquidityAsset_,
            settings_
        )
    {
        poolAccessControl = PermissionedPool(pool).poolAccessControl();
    }
}
