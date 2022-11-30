// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title The ServiceConfiguration contract
 * @dev Implementation of the {IServiceConfiguration} interface.
 */
contract ServiceConfiguration is AccessControl, IServiceConfiguration {
    /**
     * @dev The Operator Role
     */
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * @dev Whether the protocol is paused.
     */
    bool public paused = false;

    mapping(address => bool) public isLiquidityAsset;

    mapping(address => uint256) public firstLossMinimum;

    uint256 public firstLossFeeBps = 500;

    address public tosAcceptanceRegistry;

    uint256 public protocolFeeBps = 0;

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
     * @dev Constructor for the contract, which sets up the default roles and
     * owners.
     */
    constructor() {
        // Grant the contract deployer the Operator role
        _setupRole(OPERATOR_ROLE, msg.sender);
    }

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
    function setPaused(bool paused_) public onlyOperator {
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
