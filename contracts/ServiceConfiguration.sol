// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./upgrades/DeployerUUPSUpgradeable.sol";
import "hardhat/console.sol";

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
     * @dev The Operator Role
     */
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    /**
     * @dev Whether the protocol is paused.
     */
    bool public paused;

    mapping(address => bool) public isLiquidityAsset;

    mapping(address => uint256) public firstLossMinimum;

    uint256 public firstLossFeeBps;

    address public tosAcceptanceRegistry;

    uint256 public protocolFeeBps;

    /**
     * @dev Holds a reference to valid LoanFactories
     */
    mapping(address => bool) public isLoanFactory;

    /**
     * @dev Emitted when an address is changed.
     */
    event AddressSet(bytes32 which, address addr);

    /**
     * @dev Emitted when a liquidity asset is set.
     */
    event LiquidityAssetSet(address addr, bool value);

    /**
     * @dev Emitted when first loss minimum is set for an asset.
     */
    event FirstLossMinimumSet(address addr, uint256 value);

    /**
     * @dev Emitted when a parameter is set.
     */
    event ParameterSet(bytes32, uint256 value);

    /**
     * @dev Emitted when the protocol is paused.
     */
    event ProtocolPaused(bool paused);

    /**
     * @dev Emitted when a loan factory is set
     */
    event LoanFactorySet(address indexed factory, bool isValid);

    /**
     * @dev Emitted when the TermsOfServiceRegistry is set
     */
    event TermsOfServiceRegistrySet(address indexed registry);

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
     * @dev Check that `msg.sender` is an Operator.
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
