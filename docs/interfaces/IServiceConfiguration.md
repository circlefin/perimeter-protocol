# Solidity API

## IServiceConfiguration

### isOperator

```solidity
function isOperator(address addr) external view returns (bool)
```

_checks if a given address has the Operator role_

### isDeployer

```solidity
function isDeployer(address addr) external view returns (bool)
```

_checks if a given address has the Deployer role_

### paused

```solidity
function paused() external view returns (bool)
```

### firstLossMinimum

```solidity
function firstLossMinimum(address addr) external view returns (uint256)
```

### firstLossFeeBps

```solidity
function firstLossFeeBps() external view returns (uint256)
```

### isLiquidityAsset

```solidity
function isLiquidityAsset(address addr) external view returns (bool)
```

### tosAcceptanceRegistry

```solidity
function tosAcceptanceRegistry() external view returns (address)
```

### isLoanFactory

```solidity
function isLoanFactory(address addr) external view returns (bool)
```

_checks if an address is a valid loan factory_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | Address of loan factory |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool whether the loan factory is valid |

### setLoanFactory

```solidity
function setLoanFactory(address addr, bool isValid) external
```

_Sets whether a loan factory is valid_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | Address of loan factory |
| isValid | bool | Whether the loan factory is valid |

### setToSAcceptanceRegistry

```solidity
function setToSAcceptanceRegistry(address addr) external
```

_Sets the ToSAcceptanceRegistry for the protocol_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | Address of registry |

### setFirstLossMinimum

```solidity
function setFirstLossMinimum(address addr, uint256 value) external
```

_Sets the first loss minimum for the given asset_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | address of the liquidity asset |
| value | uint256 | the minimum tokens required to be deposited by pool admins |

### setFirstLossFeeBps

```solidity
function setFirstLossFeeBps(uint256 value) external
```

_Sets the first loss fee for the protocol_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | amount of each payment that is allocated to the first loss vault. Value is in basis points, e.g. 500 equals 5%. |

### setLiquidityAsset

```solidity
function setLiquidityAsset(address addr, bool value) external
```

_Sets supported liquidity assets for the protocol. Callable by the operator._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | Address of liquidity asset |
| value | bool | Whether supported or not |

