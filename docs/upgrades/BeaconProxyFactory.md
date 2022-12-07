# Solidity API

## BeaconProxyFactory

_Base contract for emitting new Beacon proxy contracts._

### _serviceConfiguration

```solidity
contract IServiceConfiguration _serviceConfiguration
```

_Address of the protocol service configuration_

### onlyDeployer

```solidity
modifier onlyDeployer()
```

_Modifier that requires that the sender is registered as a protocol deployer._

### implementation

```solidity
address implementation
```

_Returns an address used by BeaconProxy contracts for delegated calls._

### setImplementation

```solidity
function setImplementation(address newImplementation) external
```

_Updates the implementation._

