# Solidity API

## PoolFactory

### _withdrawControllerFactory

```solidity
address _withdrawControllerFactory
```

_Reference to the WithdrawControllerFactory contract_

### _poolControllerFactory

```solidity
address _poolControllerFactory
```

_Reference to the PoolControllerFactory contract_

### constructor

```solidity
constructor(address serviceConfiguration, address withdrawControllerFactory, address poolControllerFactory) public
```

### createPool

```solidity
function createPool(address liquidityAsset, struct IPoolConfigurableSettings settings) public virtual returns (address poolAddress)
```

_Creates a pool
Emits `PoolCreated` event._

### initializePool

```solidity
function initializePool(address liquidityAsset, struct IPoolConfigurableSettings settings) internal virtual returns (address)
```

_Creates the new Pool contract._

