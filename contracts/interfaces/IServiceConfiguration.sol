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

    function isLiquidityAsset(address addr) external view returns (bool);
}
