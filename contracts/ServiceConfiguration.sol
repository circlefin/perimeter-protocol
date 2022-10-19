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

    uint256 public firstLossFee = 500;

    uint256 public poolFeePercentOfInterest = 0;

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
    function setLiquidityAsset(address addr, bool value) public onlyOperator {
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

    function setPoolFeePercentOfInterest(uint256 amount) public onlyOperator {
        poolFeePercentOfInterest = amount;
        emit ParameterSet("pooFeePercentOfInterest", amount);
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
}
