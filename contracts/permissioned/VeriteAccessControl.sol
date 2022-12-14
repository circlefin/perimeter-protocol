// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/IVeriteAccessControl.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";

/**
 * @title The VeriteAccessControl contract
 * @dev Implementation of the {IPoolVeriteAccessControl} interface.
 *
 * Other contracts should inherit this contract to add Verite-specific
 * access control logic.
 */

abstract contract VeriteAccessControl is
    IVeriteAccessControl,
    EIP712Upgradeable
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
    function addTrustedVerifier(address addr) public virtual onlyVeriteAdmin {
        _trustedVerifiers[addr] = true;

        emit TrustedVerifierAdded(addr);
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function removeTrustedVerifier(address addr)
        public
        virtual
        onlyVeriteAdmin
    {
        delete _trustedVerifiers[addr];

        emit TrustedVerifierRemoved(addr);
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function addCredentialSchema(string[] calldata schema)
        public
        virtual
        onlyVeriteAdmin
    {
        _supportedCredentialSchemas[concat(schema)] = true;

        emit CredentialSchemaAdded(concat(schema));
    }

    /**
     * @inheritdoc IVeriteAccessControl
     */
    function removeCredentialSchema(string[] calldata schema)
        public
        virtual
        onlyVeriteAdmin
    {
        delete _supportedCredentialSchemas[concat(schema)];

        emit CredentialSchemaRemoved(concat(schema));
    }

    /*//////////////////////////////////////////////////////////////
                Verification
    //////////////////////////////////////////////////////////////*/

    function __VeriteAccessControl__init() internal onlyInitializing {
        __EIP712_init("VerificationRegistry", "1.0");
    }

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
    ) public virtual onlyVeriteEligible {
        string memory schema = concat(verificationResult.schema);
        // Ensure the result has a supported schema
        require(_supportedCredentialSchemas[schema], "INVALID_SCHEMA");

        // ensure that the result has not expired
        require(
            verificationResult.expiration > block.timestamp,
            "VERIFICATION_RESULT_EXPIRED"
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "VerificationResult(string[] schema,address subject,uint256 expiration,string verifier_verification_id)"
                    ),
                    keccak256(bytes(schema)),
                    verificationResult.subject,
                    verificationResult.expiration,
                    keccak256(
                        bytes(verificationResult.verifier_verification_id)
                    )
                )
            )
        );

        // recover the public address corresponding to the signature and regenerated hash
        address signerAddress = ECDSAUpgradeable.recover(digest, signature);

        // ensure the verifier is registered
        require(_trustedVerifiers[signerAddress], "INVALID_SIGNER");

        _credentialVerifications[
            verificationResult.subject
        ] = verificationResult.expiration;

        emit VerificationResultConfirmed(verificationResult.subject);
    }

    /**
     * @dev EIP-712 states the encodedData for array values are encoded as the keccak256 hash of
     * the concatenated encodeData of their contents (i.e. the encoding of SomeType[5] is identical
     * to that of a struct containing five members of type SomeType). This function supports an
     * arbitrary length array of strings and encodes them accordingly.
     *
     * The encoding specified in the EIP is very generic, and such a generic implementation in
     * Solidity is not feasible, thus EIP712Upgradeable.sol contract does not implement the
     * encoding itself. Protocols need to implement the type-specific encoding they need in their
     * contracts using a combination of `abi.encode` and `keccak256`.
     */
    function concat(string[] memory words)
        internal
        pure
        returns (string memory)
    {
        bytes memory output;

        for (uint256 i = 0; i < words.length; i++) {
            output = abi.encodePacked(output, keccak256(bytes(words[i])));
        }

        return string(output);
    }
}
