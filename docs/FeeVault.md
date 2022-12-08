# Solidity API

## FeeVault

### pool

```solidity
address pool
```

### onlyPoolAdmin

```solidity
modifier onlyPoolAdmin()
```

### constructor

```solidity
constructor(address pool_) public
```

### withdraw

```solidity
function withdraw(address asset, uint256 amount) external
```

_Allows withdrawal of fees held by vault._

