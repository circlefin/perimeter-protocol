# Solidity API

## IPoolControllerFactory

### PoolControllerCreated

```solidity
event PoolControllerCreated(address pool, address addr)
```

_Emitted when a pool is created._

### createController

```solidity
function createController(address, address, address, address, struct IPoolConfigurableSettings) external returns (address)
```

_Creates a pool's PoolAdmin controller
Emits `PoolControllerCreated` event._

