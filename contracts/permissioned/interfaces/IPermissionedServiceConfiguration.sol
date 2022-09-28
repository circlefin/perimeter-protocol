// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./IPoolManagerAccessControl.sol";
import "../../interfaces/IServiceConfiguration.sol";

/**
 * @title The protocol global Service Configuration
 */
interface IPermissionedServiceConfiguration is IServiceConfiguration {
    /**
     * @dev Determine whether the subject address has a verification record that is not expired
     */
    function poolManagerAccessControl()
        external
        view
        returns (IPoolManagerAccessControl);
}
