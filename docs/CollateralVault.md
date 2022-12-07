# Solidity API

## CollateralVault

### _loan

```solidity
address _loan
```

### onlyLoan

```solidity
modifier onlyLoan()
```

### constructor

```solidity
constructor(address loan) public
```

### withdraw

```solidity
function withdraw(address asset, uint256 amount, address receiver) external
```

_Allows withdrawal of funds held by vault._

### withdrawERC721

```solidity
function withdrawERC721(address asset, uint256 tokenId, address receiver) external
```

