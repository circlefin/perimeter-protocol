// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolManagerAccessControl.sol";
import "../ServiceConfiguration.sol";

/**
 * @title PermissionedServiceConfiguration
 */
contract PermissionedServiceConfiguration is ServiceConfiguration {
    /**
     * @dev Access Control logic for the Pool Manager role
     */
    IPoolManagerAccessControl public poolManagerAccessControl;

    /**
     * @dev Set the PoolManagerAccessControl contract.
     * @dev Emits `AddressSet` event.
     */
    function setPoolManagerAccessControl(
        IPoolManagerAccessControl _poolManagerAccessControl
    ) public onlyOperator {
        poolManagerAccessControl = _poolManagerAccessControl;
        emit AddressSet(
            "POOL_MANAGER_PERMISSION",
            address(poolManagerAccessControl)
        );
    }
}
