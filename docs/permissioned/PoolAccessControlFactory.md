# Solidity API

## PoolAccessControlFactory

### _config

```solidity
contract IPermissionedServiceConfiguration _config
```

_Reference to the ServiceConfig_

### constructor

```solidity
constructor(address serviceConfiguration) public
```

### create

```solidity
function create(address pool) external virtual returns (address)
```

_Creates a new PoolAccessControl._

