// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ITermsOfServiceConsentRegistry.sol";
import "../interfaces/IServiceConfiguration.sol";

contract TermsOfServiceConsentRegistry is ITermsOfServiceConsentRegistry {
    /**
     * @inheritdoc ITermsOfServiceConsentRegistry
     */
    mapping(address => bool) public hasConsented;

    /**
     * @dev ToS URL.
     */
    string private _termsOfService;

    /**
     * @dev ToS URL.
     */
    bool private _termsSet;

    /**
     * @dev PermissionedServiceConfiguration
     */
    IServiceConfiguration private _serviceConfig;

    /**
     * @dev Restricts caller to ServiceOperator
     */
    modifier onlyOperator() {
        require(_serviceConfig.isOperator(msg.sender), "ToS: not operator");
        _;
    }

    constructor(address serviceConfiguration) {
        _serviceConfig = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc ITermsOfServiceConsentRegistry
     */
    function recordConsent() external override {
        require(_termsSet, "ToS: not set");

        hasConsented[msg.sender] = true;
        emit ConsentRecorded(msg.sender);
    }

    /**
     * @inheritdoc ITermsOfServiceConsentRegistry
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
     * @inheritdoc ITermsOfServiceConsentRegistry
     */
    function termsOfService() external view override returns (string memory) {
        return _termsOfService;
    }
}
