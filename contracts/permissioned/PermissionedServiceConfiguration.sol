// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAdminAccessControl.sol";
import "../ServiceConfiguration.sol";

/**
 * @title PermissionedServiceConfiguration
 */
contract PermissionedServiceConfiguration is ServiceConfiguration {
    /**
     * @dev Access Control logic for the Pool Admin role
     */
    IPoolAdminAccessControl public poolAdminAccessControl;

    /**
     * @dev Set the PoolAdminAccessControl contract.
     * @dev Emits `AddressSet` event.
     */
    function setPoolAdminAccessControl(
        IPoolAdminAccessControl _poolAdminAccessControl
    ) public onlyOperator {
        poolAdminAccessControl = _poolAdminAccessControl;

        emit AddressSet(
            "POOL_ADMIN_PERMISSION",
            address(poolAdminAccessControl)
        );
    }
}
