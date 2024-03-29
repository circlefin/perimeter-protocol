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

import "./interfaces/IPoolAdminAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "./interfaces/IToSAcceptanceRegistry.sol";
import "./VeriteAccessControl.sol";
import "../upgrades/DeployerUUPSUpgradeable.sol";

/**
 * @title The PoolAdminAccessControl contract
 * @dev Implementation of the {IPoolAdminAccessControl} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the contract owner.
 */
contract PoolAdminAccessControl is
    IPoolAdminAccessControl,
    DeployerUUPSUpgradeable,
    VeriteAccessControl
{
    /**
     * @dev Reference to the ToS Acceptance Registry
     */
    IToSAcceptanceRegistry private _tosRegistry;

    /**
     * @dev Modifier to restrict the Verite Access Control logic to pool admins
     */
    modifier onlyVeriteAdmin() override {
        require(
            _serviceConfiguration.isOperator(msg.sender),
            "CALLER_NOT_OPERATOR"
        );
        _;
    }

    /**
     * @dev Modifier to restrict verification to users who have accepted the ToS
     */
    modifier onlyVeriteEligible() override {
        // Ensure the subject has accepted the ToS
        require(_tosRegistry.hasAccepted(msg.sender), "MISSING_TOS_ACCEPTANCE");
        _;
    }

    /**
     * @dev Initializer for the contract, which sets the ServiceConfiguration.
     */
    function initialize(address serviceConfiguration) public initializer {
        _serviceConfiguration = IPermissionedServiceConfiguration(
            serviceConfiguration
        );
        _tosRegistry = IToSAcceptanceRegistry(
            _serviceConfiguration.tosAcceptanceRegistry()
        );

        require(address(_tosRegistry) != address(0), "INVALID_TOS_REGISTRY");

        __VeriteAccessControl__init();
    }

    /**
     * @dev Checks against an allowList to see if the given address is allowed.
     * @inheritdoc IPoolAdminAccessControl
     */
    function isAllowed(address addr) external view returns (bool) {
        return isVerified(addr);
    }
}
