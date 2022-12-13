// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../controllers/PoolController.sol";
import "../interfaces/IPermissionedServiceConfiguration.sol";

/**
 * @title PermissionedLoan
 */
contract PermissionedPoolController is PoolController {
    /**
     * @dev a modifier to only allow Verified pool admins to perform an action
     */
    modifier onlyPermittedAdmin() override {
        require(
            IPermissionedServiceConfiguration(serviceConfiguration)
                .poolAdminAccessControl()
                .isAllowed(msg.sender),
            "ADMIN_NOT_ALLOWED"
        );
        _;
    }
}
