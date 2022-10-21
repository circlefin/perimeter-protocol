// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title The protocol global Service Configuration
 */
interface IServiceConfiguration is IAccessControl {
    /**
     * @dev checks if a given address has the Operator role
     */
    function isOperator(address addr) external view returns (bool);

    function paused() external view returns (bool);

    function firstLossFeeBps() external view returns (uint256);

    function isLiquidityAsset(address addr) external view returns (bool);

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
}
