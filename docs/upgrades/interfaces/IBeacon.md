# Solidity API

## IBeacon

_Interface of Beacon contracts._

### ImplementationSet

```solidity
event ImplementationSet(address implementation)
```

_Emitted when a new implementation is set._

### implementation

```solidity
function implementation() external view returns (address)
```

_Returns an address used by BeaconProxy contracts for delegated calls._

### setImplementation

```solidity
function setImplementation(address implementation) external
```

_Updates the implementation._

