// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title Interface defining basic Verite-specific VerificationRegistry functionality.
 */
interface IVerificationRegistry {
    /**
     * @dev Determine whether the subject address has a verification record that is not expired
     */
    function isVerified(address subject) external view returns (bool);
}
