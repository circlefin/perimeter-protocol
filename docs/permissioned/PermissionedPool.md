# Solidity API

## PermissionedPool

### poolAccessControl

```solidity
contract IPoolAccessControl poolAccessControl
```

_The reference to the access control contract_

### onlyPermittedLender

```solidity
modifier onlyPermittedLender()
```

_a modifier to only allow valid lenders to perform an action_

### initialize

```solidity
function initialize(address liquidityAsset, address poolAdmin, address serviceConfiguration, address withdrawControllerFactory, address poolControllerFactory, address poolAccessControlFactory, struct IPoolConfigurableSettings poolSettings, string tokenName, string tokenSymbol) public
```

_The initialize function for the PermissionedPool contract. It calls the
constructor of the Pool contract and then creates a new instance of the
PoolAccessControl contract._

### crank

```solidity
function crank() public
```

_Cranks the pool's withdrawals_

### maxDeposit

```solidity
function maxDeposit(address receiver) public view returns (uint256)
```

_Since Pool does not enforce that msg.sender == receiver, we only
check the receiver here._

### maxMint

```solidity
function maxMint(address receiver) public view returns (uint256)
```

_Since Pool does not enforce that msg.sender == receiver, we only
check the receiver here._

