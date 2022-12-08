# Solidity API

## VeriteAccessControl

_Implementation of the {IPoolVeriteAccessControl} interface.

Other contracts should inherit this contract to add Verite-specific
access control logic._

### _trustedVerifiers

```solidity
mapping(address => bool) _trustedVerifiers
```

_A mapping of allowed verifiers_

### _supportedCredentialSchemas

```solidity
mapping(string => bool) _supportedCredentialSchemas
```

_A list of supported credential schemas_

### _credentialVerifications

```solidity
mapping(address => uint256) _credentialVerifications
```

_A mapping of address to their latest credential verification timestamp._

### onlyVeriteAdmin

```solidity
modifier onlyVeriteAdmin()
```

_Modifier to restrict access to who can modify the Verite permissions
based on the inheriting contract_

### onlyVeriteEligible

```solidity
modifier onlyVeriteEligible()
```

_Modifier to restrict verifications to end-users who are eligible
for verification (e.g. performed some action to be eligible)_

### addTrustedVerifier

```solidity
function addTrustedVerifier(address addr) external
```

_Add a trusted Verifier

Emits a {TrustedVerifierAdded} event._

### removeTrustedVerifier

```solidity
function removeTrustedVerifier(address addr) external
```

_Remove a trusted Verifier

Emits a {TrustedVerifierRemoved} event._

### addCredentialSchema

```solidity
function addCredentialSchema(string schema) external
```

_Add a supported credential schema

Emits a {CredentialSchemaAdded} event._

### removeCredentialSchema

```solidity
function removeCredentialSchema(string schema) external
```

_Remove a supported credential schema

Emits a {CredentialSchemaRemoved} event._

### isVerified

```solidity
function isVerified(address addr) internal view returns (bool)
```

_Check if an address is verified_

### verify

```solidity
function verify(struct VerificationResult verificationResult, bytes signature) external
```

_Verifies a verification result and adds it to the list of valid
credentials until the expiration time.

A verifier provides a signed hash of a verification result it has created
for a subject address. This function recreates the hash given the result
artifacts and then uses it and the signature to recover the public
address of the signer. If that address is a trusted verifier's signing
address, and the assessment completes within the deadline (unix time in
seconds since epoch), then the verification succeeds and is valid until
revocation, expiration, or removal from storage.

NOTE: This function allows anyone (e.g. a verifier) to submit a
verification result on behalf of other subjects.

Emits a {VerificationResultConfirmed} event._

