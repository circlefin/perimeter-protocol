// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/IToSAcceptanceRegistry.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../upgrades/DeployerUUPSUpgradeable.sol";

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
    function updateTermsOfService(string memory url)
        external
        override
        onlyOperator
    {
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
