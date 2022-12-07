# Solidity API

## IPoolFactory

### PoolCreated

```solidity
event PoolCreated(address addr)
```

_Emitted when a pool is created._

### createPool

```solidity
function createPool(address, struct IPoolConfigurableSettings) external returns (address)
```

_Creates a pool's PoolAdmin controller
Emits `PoolControllerCreated` event._

