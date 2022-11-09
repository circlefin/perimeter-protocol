// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "./interfaces/IToSAcceptanceRegistry.sol";
import "../interfaces/IPool.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title The PoolAccessControl contract
 * @dev Implementation of the {IPoolAccessControl} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the Pool Admin.
 */
contract PoolAccessControl is
    IPoolAccessControl,
    EIP712("PoolAccessControl", "1.0")
{
    /**
     * @dev Reference to the pool
     */
    IPool private _pool;

    /**
     * @dev Reference to the ToS Acceptance Registry
     */
    IToSAcceptanceRegistry private _tosRegistry;

    /**
     * @dev A mapping of addresses to whether they are allowed to lend or borrower in the pool.
     */
    mapping(address => bool) private _allowedParticipants;

    /**
     * @dev A mapping of address to their latest credential verification timestamp.
     */
    mapping(address => uint256) private _credentialVerifications;

    /**
     * @dev A mapping of allowed verifiers
     */
    mapping(address => bool) private _verifiers;

    /**
     * @dev A list of supported credential schemas
     */
    mapping(string => bool) private _supportedCredentialSchemas;

    /**
     * @dev Emitted when an address is added from the participant allow list.
     */
    event ParticipantAllowed(address indexed addr);

    /**
     * @dev Emitted when an address is removed from the participant allow list.
     */
    event ParticipantRemoved(address indexed addr);

    /**
     * @dev Emitted when an address validate via Verite
     */
    event VerificationResultConfirmed(address indexed addr);

    /**
     * @dev Emitted when a new Verifier is added
     */
    event VerifierAdded(address addr);

    /**
     * @dev Emitted when a Verifier is removed
     */
    event VerifierRemoved(address addr);

    /**
     * @dev Emitted when a new credential schema is added
     */
    event CredentialSchemaAdded(string schema);

    /**
     * @dev Emitted when a credential schema is removed
     */
    event CredentialSchemaRemoved(string schema);

    /**
     * @dev Modifier that checks that the caller is the pool's admin.
     */
    modifier onlyPoolAdmin() {
        require(msg.sender == _pool.admin(), "Pool: caller is not admin");
        _;
    }

    /**
     * @dev The constructor for the PoolAccessControl contract
     */
    constructor(address pool, address tosAcceptanceRegistry) {
        require(
            tosAcceptanceRegistry != address(0),
            "Pool: invalid ToS registry"
        );

        _pool = IPool(pool);
        _tosRegistry = IToSAcceptanceRegistry(tosAcceptanceRegistry);
    }

    /**
     * @dev Checks if the given address is allowed as a Participant.
     * @inheritdoc IPoolAccessControl
     */
    function isValidParticipant(address addr) external view returns (bool) {
        return
            _allowedParticipants[addr] ||
            _credentialVerifications[addr] > block.timestamp;
    }

    /**
     * @dev Adds an address to the participant allow list.
     *
     * Emits an {AllowedParticipantListUpdated} event.
     */
    function allowParticipant(address addr) external onlyPoolAdmin {
        require(
            _tosRegistry.hasAccepted(addr),
            "Pool: participant not accepted ToS"
        );
        _allowedParticipants[addr] = true;
        emit ParticipantAllowed(addr);
    }

    /**
     * @dev Removes an address from the participant allow list.
     *
     * Emits an {AllowedParticipantListUpdated} event.
     */
    function removeParticipant(address addr) external onlyPoolAdmin {
        delete _allowedParticipants[addr];
        emit ParticipantRemoved(addr);
    }

    /**
     * @dev Add a supported Verifier
     *
     * Emits a {VerifierAdded} event.
     */
    function addVerifier(address addr) external onlyPoolAdmin {
        _verifiers[addr] = true;
        emit VerifierAdded(addr);
    }

    /**
     * @dev Remove a supported Verifier
     *
     * Emits a {VerifierRemoved} event.
     */
    function removeVerifier(address addr) external onlyPoolAdmin {
        delete _verifiers[addr];
        emit VerifierRemoved(addr);
    }

    /**
     * @dev Add a supported credential schema
     *
     * Emits a {CredentialSchemaAdded} event.
     */
    function addSchema(string calldata schema) external onlyPoolAdmin {
        _supportedCredentialSchemas[schema] = true;
        emit CredentialSchemaAdded(schema);
    }

    /**
     * @dev Remove a supported credential schema
     *
     * Emits a {CredentialSchemaRemoved} event.
     */
    function removeSchema(string calldata schema) external onlyPoolAdmin {
        delete _supportedCredentialSchemas[schema];
        emit CredentialSchemaRemoved(schema);
    }

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
    function verify(
        VerificationResult memory verificationResult,
        bytes memory signature
    ) external {
        // Ensure the subject has accepted the ToS
        require(
            _tosRegistry.hasAccepted(verificationResult.subject),
            "PoolAccessControl: subject not accepted ToS"
        );

        // Ensure the result has a supported schema
        require(
            _supportedCredentialSchemas[verificationResult.schema],
            "PoolAccessControl: unsupported credential schema"
        );

        // ensure that the result has not expired
        require(
            verificationResult.expiration > block.timestamp,
            "PoolAccessControl: Verification result expired"
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "VerificationResult(string schema,address subject,uint256 expiration,string verifier_verification_id)"
                    ),
                    keccak256(bytes(verificationResult.schema)),
                    verificationResult.subject,
                    verificationResult.expiration,
                    keccak256(
                        bytes(verificationResult.verifier_verification_id)
                    )
                )
            )
        );

        // recover the public address corresponding to the signature and regenerated hash
        address signerAddress = ECDSA.recover(digest, signature);

        // ensure the verifier is registered
        require(
            _verifiers[signerAddress],
            "PoolAccessControl: Signed digest cannot be verified"
        );

        _credentialVerifications[
            verificationResult.subject
        ] = verificationResult.expiration;

        emit VerificationResultConfirmed(verificationResult.subject);
    }
}
