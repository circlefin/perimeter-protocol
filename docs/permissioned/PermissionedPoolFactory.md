# Solidity API

## PermissionedPoolFactory

### _poolAccessControlFactory

```solidity
address _poolAccessControlFactory
```

_Reference to a PoolAccessControlFactory_

### onlyVerifiedPoolAdmin

```solidity
modifier onlyVerifiedPoolAdmin()
```

_Check that `msg.sender` is a PoolAdmin._

### constructor

```solidity
constructor(address serviceConfiguration, address withdrawControllerFactory, address poolControllerFactory, address poolAccessControlFactory) public
```

### createPool

```solidity
function createPool(address liquidityAsset, struct IPoolConfigurableSettings settings) public returns (address)
```

_Restricts callers to verified PoolAdmins_

### initializePool

```solidity
function initializePool(address liquidityAsset, struct IPoolConfigurableSettings settings) internal returns (address)
```

_Injects access control into the PermissionedPool_

