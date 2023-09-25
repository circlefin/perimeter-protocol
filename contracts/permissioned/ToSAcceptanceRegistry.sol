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

import "./interfaces/IToSAcceptanceRegistry.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../upgrades/DeployerUUPSUpgradeable.sol";

/**
 * @title Terms of Service Acceptance Registry.
 * @dev Terms of Service acceptance is required in the permissioned version of Perimeter
 * before lenders, borrowers, or PoolAdmin's can meaningfully interact with the protocol.
 */
contract ToSAcceptanceRegistry is
    IToSAcceptanceRegistry,
    DeployerUUPSUpgradeable
{
    /**
     * @inheritdoc IToSAcceptanceRegistry
     */
    mapping(address => bool) public hasAccepted;

    /**
     * @dev ToS URL.
     */
    string private _termsOfService;

    /**
     * @dev Flag to track when the ToS are "initialized"
     */
    bool private _termsSet;

    /**
     * @dev Restricts caller to ServiceOperator
     */
    modifier onlyOperator() {
        require(
            _serviceConfiguration.isOperator(msg.sender),
            "ToS: not operator"
        );
        _;
    }

    /**
     * @dev Initializer for the ToSAcceptanceRegistry
     */
    function initialize(address serviceConfiguration) public initializer {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IToSAcceptanceRegistry
     */
    function acceptTermsOfService() external override {
        require(_termsSet, "ToS: not set");

        hasAccepted[msg.sender] = true;
        emit AcceptanceRecorded(msg.sender);
    }

    /**
     * @inheritdoc IToSAcceptanceRegistry
     */
    function updateTermsOfService(
        string memory url
    ) external override onlyOperator {
        _termsOfService = url;
        _termsSet = true;
        emit TermsOfServiceUpdated();
    }

    /**
     * @inheritdoc IToSAcceptanceRegistry
     */
    function termsOfService() external view override returns (string memory) {
        return _termsOfService;
    }
}
