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
