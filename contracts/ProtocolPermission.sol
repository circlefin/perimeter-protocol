// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IProtocolPermission.sol";

contract ProtocolPermission is IProtocolPermission {
    /**
     * @dev See {IProtocolPermission-isAllowed}.
     */
    function isAllowed(address) external pure returns (bool) {
        return true;
    }
}
