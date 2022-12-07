# Solidity API

## IVeriteAccessControl

### TrustedVerifierAdded

```solidity
event TrustedVerifierAdded(address addr)
```

_Emitted when a new Verifier is added_

### TrustedVerifierRemoved

```solidity
event TrustedVerifierRemoved(address addr)
```

_Emitted when a Verifier is removed_

### CredentialSchemaAdded

```solidity
event CredentialSchemaAdded(string schema)
```

_Emitted when a new credential schema is added_

### CredentialSchemaRemoved

```solidity
event CredentialSchemaRemoved(string schema)
```

_Emitted when a credential schema is removed_

### VerificationResultConfirmed

```solidity
event VerificationResultConfirmed(address addr)
```

_Emitted when an address validate via Verite_

### addTrustedVerifier

```solidity
function addTrustedVerifier(address) external
```

_Add a trusted Verifier

Emits a {TrustedVerifierAdded} event._

### removeTrustedVerifier

```solidity
function removeTrustedVerifier(address) external
```

_Remove a trusted Verifier

Emits a {TrustedVerifierRemoved} event._

### addCredentialSchema

```solidity
function addCredentialSchema(string) external
```

_Add a supported credential schema

Emits a {CredentialSchemaAdded} event._

### removeCredentialSchema

```solidity
function removeCredentialSchema(string) external
```

_Remove a supported credential schema

Emits a {CredentialSchemaRemoved} event._

### verify

```solidity
function verify(struct VerificationResult, bytes) external
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

## VerificationResult

```solidity
struct VerificationResult {
  string schema;
  address subject;
  uint256 expiration;
  string verifier_verification_id;
}
```

