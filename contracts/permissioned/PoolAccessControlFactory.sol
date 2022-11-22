// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAccessControlFactory.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../LoanFactory.sol";
import "./PoolAccessControl.sol";

/**
 * @title PoolAccessControlFactory
 */
contract PoolAccessControlFactory is IPoolAccessControlFactory {
    /**
     * @dev Reference to the ServiceConfig
     */
    IPermissionedServiceConfiguration private _config;

    constructor(address serviceConfiguration) {
        _config = IPermissionedServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IPoolAccessControlFactory
     */
    function create(address pool) external virtual override returns (address) {
        return
            address(
                new PoolAccessControl(pool, _config.tosAcceptanceRegistry())
            );
    }
}
