// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../controllers/PoolController.sol";
import "../interfaces/IPermissionedServiceConfiguration.sol";

/**
 * @title Permissioned version of the PoolController
 * @dev Ensures Pool Admin's are allowed at the time of any transaction.
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
