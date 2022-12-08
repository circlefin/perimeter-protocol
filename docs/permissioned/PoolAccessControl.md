# Solidity API

## PoolAccessControl

_Implementation of the {IPoolAccessControl} interface.

This implementation implements a basic Allow-List of addresses, which can
be managed only by the Pool Admin._

### _pool

```solidity
contract IPool _pool
```

_Reference to the pool_

### _tosRegistry

```solidity
contract IToSAcceptanceRegistry _tosRegistry
```

_Reference to the ToS Acceptance Registry_

### _allowedParticipants

```solidity
mapping(address => bool) _allowedParticipants
```

_A mapping of addresses to whether they are allowed to lend or borrower in the pool._

### ParticipantAllowed

```solidity
event ParticipantAllowed(address addr)
```

_Emitted when an address is added from the participant allow list._

### ParticipantRemoved

```solidity
event ParticipantRemoved(address addr)
```

_Emitted when an address is removed from the participant allow list._

### onlyPoolAdmin

```solidity
modifier onlyPoolAdmin()
```

_Modifier that checks that the caller is the pool's admin._

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
constructor(address pool, address tosAcceptanceRegistry) public
```

_The constructor for the PoolAccessControl contract_

### isAllowed

```solidity
function isAllowed(address addr) external view returns (bool)
```

_Check if an address is allowed as a participant in the pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | The address to verify |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether the address is allowed as a participant |

### allowParticipant

```solidity
function allowParticipant(address addr) external
```

_Adds an address to the participant allow list.

Emits an {AllowedParticipantListUpdated} event._

### removeParticipant

```solidity
function removeParticipant(address addr) external
```

_Removes an address from the participant allow list.

Emits an {AllowedParticipantListUpdated} event._

