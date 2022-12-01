// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IVeriteAccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

/**
 * @title The VeriteAccessControl contract
 * @dev Implementation of the {IPoolVeriteAccessControl} interface.
 *
 * Other contracts should inherit this contract to add Verite-specific
 * access control logic.
 */
contract VeriteAccessControl is
    IVeriteAccessControl,
    EIP712("VerificationRegistry", "1.0")
{
    /**
     * @dev A mapping of allowed verifiers
     */
    mapping(address => bool) private _trustedVerifiers;

    /**
     * @dev A list of supported credential schemas
     */
    mapping(string => bool) private _supportedCredentialSchemas;

    /**
     * @dev A mapping of address to their latest credential verification timestamp.
     */
    mapping(address => uint256) private _credentialVerifications;

    /*//////////////////////////////////////////////////////////////
                Modifiers
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Modifier to restrict access to who can modify the Verite permissions
     * based on the inheriting contract
     */
    modifier onlyVeriteAdmin() virtual {
        _;
    }

    /**
     * @dev Modifier to restrict verifications to end-users who are eligible
     * for verification (e.g. performed some action to be eligible)
     */
    modifier onlyVeriteEligible() virtual {
        _;
    }

    /*//////////////////////////////////////////////////////////////
                Settings
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function addTrustedVerifier(address addr) external onlyVeriteAdmin {
        _trustedVerifiers[addr] = true;

        emit TrustedVerifierAdded(addr);
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function removeTrustedVerifier(address addr) external onlyVeriteAdmin {
        delete _trustedVerifiers[addr];

        emit TrustedVerifierRemoved(addr);
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function addCredentialSchema(string calldata schema)
        external
        onlyVeriteAdmin
    {
        _supportedCredentialSchemas[schema] = true;

        emit CredentialSchemaAdded(schema);
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function removeCredentialSchema(string calldata schema)
        external
        onlyVeriteAdmin
    {
        delete _supportedCredentialSchemas[schema];

        emit CredentialSchemaRemoved(schema);
    }

    /*//////////////////////////////////////////////////////////////
                Verification
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Check if an address is verified
     */
    function isVerified(address addr) internal view returns (bool) {
        return _credentialVerifications[addr] > block.timestamp;
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function verify(
        VerificationResult memory verificationResult,
        bytes memory signature
    ) external onlyVeriteEligible {
        require(verificationResult.subject == msg.sender, "SUBJECT_MISMATCH");

        // Ensure the result has a supported schema
        require(
            _supportedCredentialSchemas[verificationResult.schema],
            "INVALID_CREDENTIAL_SCHEMA"
        );

        // ensure that the result has not expired
        require(
            verificationResult.expiration > block.timestamp,
            "VERIFICATION_RESULT_EXPIRED"
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
        require(_trustedVerifiers[signerAddress], "INVALID_SIGNER");

        _credentialVerifications[
            verificationResult.subject
        ] = verificationResult.expiration;

        emit VerificationResultConfirmed(verificationResult.subject);
    }
}
