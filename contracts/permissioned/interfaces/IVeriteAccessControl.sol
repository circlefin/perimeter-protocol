/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.16;

/**
 * @title The interface for a contract that processes trusted Verite credential verifications.
 */
interface IVeriteAccessControl {
    /*//////////////////////////////////////////////////////////////
                Events
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Emitted when a new Verifier is added
     */
    event TrustedVerifierAdded(address addr);

    /**
     * @dev Emitted when a Verifier is removed
     */
    event TrustedVerifierRemoved(address addr);

    /**
     * @dev Emitted when a new credential schema is added
     */
    event CredentialSchemaAdded(string[] schema);

    /**
     * @dev Emitted when a credential schema is removed
     */
    event CredentialSchemaRemoved(string[] schema);

    /**
     * @dev Emitted when an address validate via Verite
     */
    event VerificationResultConfirmed(address indexed addr);

    /*//////////////////////////////////////////////////////////////
                Settings
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Add a trusted Verifier
     *
     * Emits a {TrustedVerifierAdded} event.
     */
    function addTrustedVerifier(address) external;

    /**
     * @dev Remove a trusted Verifier
     *
     * Emits a {TrustedVerifierRemoved} event.
     */
    function removeTrustedVerifier(address) external;

    /**
     * @dev Add a supported credential schema
     *
     * Emits a {CredentialSchemaAdded} event.
     */
    function addCredentialSchema(string[] calldata) external;

    /**
     * @dev Remove a supported credential schema
     *
     * Emits a {CredentialSchemaRemoved} event.
     */
    function removeCredentialSchema(string[] calldata) external;

    /*//////////////////////////////////////////////////////////////
                Verification
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Verifies a verification result and adds it to the list of valid
     * credentials until the expiration time.
     *
     * A verifier provides a signed hash of a verification result it has created
     * for a subject address. This function recreates the hash given the result
     * artifacts and then uses it and the signature to recover the public
     * address of the signer. If that address is a trusted verifier's signing
     * address, and the assessment completes within the deadline (unix time in
     * seconds since epoch), then the verification succeeds and is valid until
     * revocation, expiration, or removal from storage.
     *
     * NOTE: This function allows anyone (e.g. a verifier) to submit a
     * verification result on behalf of other subjects.
     *
     * Emits a {VerificationResultConfirmed} event.
     */
    function verify(VerificationResult memory, bytes memory) external;
}

/**
 * @dev Verite credentials will submit a verification result in this format.
 */
struct VerificationResult {
    string[] schema; // indicator of the type of verification result
    address subject; // address of the subject of the verification
    uint256 expiration; // expiration of verification (may or may not be expiration of the VC)
    string verifier_verification_id; // Unique ID from the verifier
}
