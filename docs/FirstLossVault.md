# Solidity API

## FirstLossVault

### poolController

```solidity
address poolController
```

### _asset

```solidity
contract IERC20 _asset
```

### onlyPoolController

```solidity
modifier onlyPoolController()
```

_Modifier restricting access to pool_

### constructor

```solidity
constructor(address _poolController, address firstLossAsset) public
```

_Constructor for the vault_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolController | address | address of pool controller |
| firstLossAsset | address | asset held by vault |

### asset

```solidity
function asset() external view returns (address)
```

_Returns the asset held by the vault._

### withdraw

```solidity
function withdraw(uint256 amount, address receiver) external
```

_Allows withdrawal of funds held by vault._

