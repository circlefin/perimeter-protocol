# Solidity API

## PoolAdminAccessControl

_Implementation of the {IPoolAdminAccessControl} interface.

This implementation implements a basic Allow-List of addresses, which can
be managed only by the contract owner._

### _serviceConfiguration

```solidity
contract IPermissionedServiceConfiguration _serviceConfiguration
```

_Reference to the PermissionedServiceConfiguration contract_

### _tosRegistry

```solidity
contract IToSAcceptanceRegistry _tosRegistry
```

_Reference to the ToS Acceptance Registry_

### onlyVeriteAdmin

```solidity
modifier onlyVeriteAdmin()
```

_Modifier to restrict the Verite Access Control logic to pool admins_

### onlyVeriteEligible

```solidity
modifier onlyVeriteEligible()
```

_Modifier to restrict verification to users who have accepted the ToS_

### constructor

```solidity
constructor(address serviceConfiguration) public
```

_Constructor for the contract, which sets the ServiceConfiguration._

### isAllowed

```solidity
function isAllowed(address addr) external view returns (bool)
```

_Checks against an allowList to see if the given address is allowed._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | The address to verify |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether the address is allowed as a Pool Admin |

