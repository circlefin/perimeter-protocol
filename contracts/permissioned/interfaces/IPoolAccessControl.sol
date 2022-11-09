// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The interface for controlling access to Pools
 */
interface IPoolAccessControl {
    /**
     * @dev Check if an address is allowed as a participant in the pool
     * @param addr The address to verify
     * @return whether the address is allowed as a participant
     */
    function isValidParticipant(address addr) external view returns (bool);
}

/**
 * @dev Verite credentials will submit a verification result in this format.
 */
struct VerificationResult {
    string schema; // indicator of the type of verification result
    address subject; // address of the subject of the verification
    uint256 expiration; // expiration of verification (may or may not be expiration of the VC)
    string verifier_verification_id; // Unique ID from the verifier
}
