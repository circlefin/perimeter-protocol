// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title The protocol global Service Configuration
 */
interface IServiceConfiguration {
    /**
     * @dev checks if a given address has the Operator role
     */
    function isOperator(address addr) external view returns (bool);

    /**
     * @dev checks if a given address has the Deployer role
     */
    function isDeployer(address addr) external view returns (bool);

    function paused() external view returns (bool);

    function firstLossMinimum(address addr) external view returns (uint256);

    function firstLossFeeBps() external view returns (uint256);

    function isLiquidityAsset(address addr) external view returns (bool);

    function tosAcceptanceRegistry() external view returns (address);

    /**
     * @dev checks if an address is a valid loan factory
     * @param addr Address of loan factory
     * @return bool whether the loan factory is valid
     */
    function isLoanFactory(address addr) external view returns (bool);

    /**
     * @dev Sets whether a loan factory is valid
     * @param addr Address of loan factory
     * @param isValid Whether the loan factory is valid
     */
    function setLoanFactory(address addr, bool isValid) external;

    /**
     * @dev Sets the ToSAcceptanceRegistry for the protocol
     * @param addr Address of registry
     */
    function setToSAcceptanceRegistry(address addr) external;

    /**
     * @dev Sets the first loss minimum for the given asset
     * @param addr address of the liquidity asset
     * @param value the minimum tokens required to be deposited by pool admins
     */
    function setFirstLossMinimum(address addr, uint256 value) external;

    /**
     * @dev Sets the first loss fee for the protocol
     * @param value amount of each payment that is allocated to the first loss vault. Value is in basis points, e.g. 500 equals 5%.
     */
    function setFirstLossFeeBps(uint256 value) external;

    /**
     * @dev Sets supported liquidity assets for the protocol. Callable by the operator.
     * @param addr Address of liquidity asset
     * @param value Whether supported or not
     */
    function setLiquidityAsset(address addr, bool value) external;
}
