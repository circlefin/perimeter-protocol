# Solidity API

## FundingVault

### _loan

```solidity
address _loan
```

### asset

```solidity
contract IERC20 asset
```

### onlyLoan

```solidity
modifier onlyLoan()
```

_Modifier restricting access to pool_

### constructor

```solidity
constructor(address loan, address asset_) public
```

_Constructor for the vault_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| loan | address | address of loan |
| asset_ | address | asset held by vault |

### withdraw

```solidity
function withdraw(uint256 amount, address receiver) external
```

_Allows withdrawal of funds held by vault._

