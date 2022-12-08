# Solidity API

## IToSAcceptanceRegistry

### AcceptanceRecorded

```solidity
event AcceptanceRecorded(address accepter)
```

_Emitted when someone accepts the ToS._

### TermsOfServiceUpdated

```solidity
event TermsOfServiceUpdated()
```

_Emitted when the Terms of Service is updated._

### termsOfService

```solidity
function termsOfService() external view returns (string)
```

_Returns the current TermsOfService URL_

### updateTermsOfService

```solidity
function updateTermsOfService(string url) external
```

_Updates the TermsOfService._

### acceptTermsOfService

```solidity
function acceptTermsOfService() external
```

_Records that msg.sender has accepted the TermsOfService._

### hasAccepted

```solidity
function hasAccepted(address addr) external view returns (bool)
```

_Returns whether an address has accepted the TermsOfService._

