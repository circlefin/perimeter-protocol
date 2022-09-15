// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/IVerificationRegistry.sol";

contract MockVeriteVerificationRegistry is IVerificationRegistry {
    /**
     * @inheritdoc IVerificationRegistry
     */
    function isVerified(address) external pure override returns (bool) {
        return true;
    }
}
