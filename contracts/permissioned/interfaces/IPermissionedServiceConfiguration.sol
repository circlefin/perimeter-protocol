// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IPoolAdminAccessControl.sol";
import "../../interfaces/IServiceConfiguration.sol";

/**
 * @title The protocol global Service Configuration
 */
interface IPermissionedServiceConfiguration is IServiceConfiguration {
    /**
     * @dev Reference to the PoolAdminAccessControl, which enforces access control on Pool Admins.
     */
    function poolAdminAccessControl()
        external
        view
        returns (IPoolAdminAccessControl);
}
