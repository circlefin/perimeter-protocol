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

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./upgrades/DeployerUUPSUpgradeable.sol";

/**
 * @title The ServiceConfiguration contract
 * @dev Implementation of the {IServiceConfiguration} interface.
 */
contract ServiceConfiguration is
    IServiceConfiguration,
    AccessControlUpgradeable,
    DeployerUUPSUpgradeable
{
    /**
     * @dev The Operator Role
     */
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * @dev The Pauser Role
     */
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @dev The Deployer Role
     */
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    /**
     * @inheritdoc IServiceConfiguration
     */
    bool public paused;

    /**
     * @inheritdoc IServiceConfiguration
     */
    mapping(address => bool) public isLiquidityAsset;

    /**
     * @inheritdoc IServiceConfiguration
     */
    mapping(address => uint256) public firstLossMinimum;

    /**
     * @inheritdoc IServiceConfiguration
     */
    uint256 public firstLossFeeBps;

    /**
     * @inheritdoc IServiceConfiguration
     */
    address public tosAcceptanceRegistry;

    /**
     * @inheritdoc IServiceConfiguration
     */
    uint256 public protocolFeeBps;

    /**
     * @inheritdoc IServiceConfiguration
     */
    mapping(address => bool) public isLoanFactory;

    /**
     * @dev Modifier that checks that the caller account has the Operator role.
     */
    modifier onlyOperator() {
        require(
            hasRole(OPERATOR_ROLE, msg.sender),
            "ServiceConfiguration: caller is not an operator"
        );
        _;
    }

    /**
     * @dev Require the caller be the pauser
     */
    modifier onlyPauser() {
        require(
            hasRole(PAUSER_ROLE, msg.sender),
            "ServiceConfiguration: caller is not a pauser"
        );
        _;
    }

    /**
     * @dev Constructor for the contract, which sets up the default roles and
     * owners.
     */
    function initialize() public initializer {
        // Initialize values
        paused = false;
        firstLossFeeBps = 500;
        protocolFeeBps = 0;
        _serviceConfiguration = IServiceConfiguration(address(this));

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Set a liquidity asset as valid or not.
     */
    function setLiquidityAsset(address addr, bool value)
        public
        override
        onlyOperator
    {
        isLiquidityAsset[addr] = value;
        emit LiquidityAssetSet(addr, value);
    }

    /**
     * @dev Pause/unpause the protocol.
     */
    function setPaused(bool paused_) public onlyPauser {
        paused = paused_;
        emit ProtocolPaused(paused);
    }

    /**
     * @inheritdoc IServiceConfiguration
     */
    function isOperator(address addr) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, addr);
    }

    /**
     * @inheritdoc IServiceConfiguration
     */
    function isDeployer(address addr) external view returns (bool) {
        return hasRole(DEPLOYER_ROLE, addr);
    }

    /**
     * @inheritdoc IServiceConfiguration
     */
    function setLoanFactory(address addr, bool isValid)
        external
        override
        onlyOperator
    {
        isLoanFactory[addr] = isValid;
        emit LoanFactorySet(addr, isValid);
    }

    /**
     * @inheritdoc IServiceConfiguration
     */
    function setToSAcceptanceRegistry(address addr)
        external
        override
        onlyOperator
    {
        tosAcceptanceRegistry = addr;
        emit TermsOfServiceRegistrySet(addr);
    }

    /**
     * @inheritdoc IServiceConfiguration
     */
    function setFirstLossMinimum(address addr, uint256 value)
        external
        override
        onlyOperator
    {
        firstLossMinimum[addr] = value;
        emit FirstLossMinimumSet(addr, value);
    }

    /**
     * @inheritdoc IServiceConfiguration
     */
    function setFirstLossFeeBps(uint256 value) external override onlyOperator {
        firstLossFeeBps = value;
        emit ParameterSet("firstLossFeeBps", value);
    }
}
