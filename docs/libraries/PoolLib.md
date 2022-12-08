# Solidity API

## PoolLib

### RAY

```solidity
uint256 RAY
```

### FirstLossDeposited

```solidity
event FirstLossDeposited(address caller, address spender, uint256 amount)
```

_Emitted when first loss is supplied to the pool._

### FirstLossWithdrawn

```solidity
event FirstLossWithdrawn(address caller, address receiver, uint256 amount)
```

_Emitted when first loss is withdrawn from the pool._

### Deposit

```solidity
event Deposit(address caller, address owner, uint256 assets, uint256 shares)
```

_See IERC4626 for event definition._

### FirstLossApplied

```solidity
event FirstLossApplied(address loan, uint256 amount)
```

_See IPool_

### LoanDefaulted

```solidity
event LoanDefaulted(address loan)
```

_See IPool for event definition_

### PoolSettingsUpdated

```solidity
event PoolSettingsUpdated()
```

_Emitted when pool settings are updated._

### isPoolLoan

```solidity
function isPoolLoan(address loan, address serviceConfiguration, address pool) public view returns (bool)
```

_Determines whether an address corresponds to a pool loan_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| loan | address | address of loan |
| serviceConfiguration | address | address of service configuration |
| pool | address | address of pool |

### divideCeil

```solidity
function divideCeil(uint256 lhs, uint256 rhs) internal pure returns (uint256)
```

_Divide two numbers and round the result up_

### executeFirstLossDeposit

```solidity
function executeFirstLossDeposit(address liquidityAsset, address spender, uint256 amount, address firstLossVault, enum IPoolLifeCycleState currentState, uint256 minFirstLossRequired) external returns (enum IPoolLifeCycleState newState)
```

_Transfers first loss to the vault._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityAsset | address | Pool liquidity asset |
| spender | address |  |
| amount | uint256 | Amount of first loss being contributed |
| firstLossVault | address |  |
| currentState | enum IPoolLifeCycleState | Lifecycle state of the pool |
| minFirstLossRequired | uint256 | The minimum amount of first loss the pool needs to become active |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| newState | enum IPoolLifeCycleState | The updated Pool lifecycle state |

### executeFirstLossWithdraw

```solidity
function executeFirstLossWithdraw(uint256 amount, address withdrawReceiver, address firstLossVault) external returns (uint256)
```

_Withdraws first loss capital. Can only be called by the Pool admin under certain conditions._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of first loss being withdrawn |
| withdrawReceiver | address | Where the liquidity should be withdrawn to |
| firstLossVault | address | Vault holding first loss |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | newState The updated Pool lifecycle state |

### calculateExpectedInterest

```solidity
function calculateExpectedInterest(struct EnumerableSet.AddressSet activeLoans) external view returns (uint256 expectedInterest)
```

_Calculates total sum of expected interest_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| activeLoans | struct EnumerableSet.AddressSet | All active pool loans, i.e. they've been drawndown, and interest is accruing |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| expectedInterest | uint256 | The total sum of expected accrued interest at this block |

### calculateConversion

```solidity
function calculateConversion(uint256 input, uint256 numerator, uint256 denominator, bool roundUp) external pure returns (uint256 output)
```

_Computes the exchange rate for converting assets to shares_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| input | uint256 | The input to the conversion |
| numerator | uint256 | Numerator of the conversion rate |
| denominator | uint256 | Denominator of the conversion rate |
| roundUp | bool | Whether it should be rounded up or down. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| output | uint256 | The converted amount |

### calculateTotalAssets

```solidity
function calculateTotalAssets(address asset, address vault, uint256 outstandingLoanPrincipals) public view returns (uint256 totalAssets)
```

_Calculates total assets held by Vault (including those marked for withdrawal)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | Amount of total assets held by the Vault |
| vault | address | Address of the ERC4626 vault |
| outstandingLoanPrincipals | uint256 | Sum of all oustanding loan principals |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalAssets | uint256 | Total assets |

### calculateTotalAvailableAssets

```solidity
function calculateTotalAvailableAssets(address asset, address vault, uint256 outstandingLoanPrincipals, uint256 withdrawableAssets) external view returns (uint256 totalAvailableAssets)
```

_Calculates total assets held by Vault (excluding marked for withdrawal)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | Amount of total assets held by the Vault |
| vault | address | Address of the ERC4626 vault |
| outstandingLoanPrincipals | uint256 | Sum of all oustanding loan principals |
| withdrawableAssets | uint256 | Sum of all withdrawable assets |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalAvailableAssets | uint256 | Total available assets (excluding marked for withdrawal) |

### calculateTotalAvailableShares

```solidity
function calculateTotalAvailableShares(address vault, uint256 redeemableShares) external view returns (uint256 totalAvailableShares)
```

_Calculates total shares held by Vault (excluding marked for redemption)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| vault | address | Address of the ERC4626 vault |
| redeemableShares | uint256 | Sum of all withdrawable assets |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalAvailableShares | uint256 | Total redeemable shares (excluding marked for redemption) |

### calculateMaxDeposit

```solidity
function calculateMaxDeposit(enum IPoolLifeCycleState poolLifeCycleState, uint256 poolMaxCapacity, uint256 totalAvailableAssets) external pure returns (uint256)
```

_Calculates the max deposit allowed in the pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolLifeCycleState | enum IPoolLifeCycleState | The current pool lifecycle state |
| poolMaxCapacity | uint256 | Max pool capacity allowed per the pool settings |
| totalAvailableAssets | uint256 | Sum of all pool assets (excluding marked for withdrawal) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Max deposit allowed |

### executeDeposit

```solidity
function executeDeposit(address asset, address vault, address sharesReceiver, uint256 assets, uint256 shares, uint256 maxDeposit, function (address,uint256) mint, struct IPoolAccountings accountings) internal returns (uint256)
```

_Executes a deposit into the pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | Pool liquidity asset |
| vault | address | Address of ERC4626 vault |
| sharesReceiver | address | Address of receiver of shares |
| assets | uint256 | Amount of assets being deposited |
| shares | uint256 | Amount of shares being minted |
| maxDeposit | uint256 | Max allowed deposit into the pool |
| mint | function (address,uint256) | A pointer to the mint function |
| accountings | struct IPoolAccountings |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of shares being minted |

### executeDefault

```solidity
function executeDefault(address asset, address firstLossVault, address loan, address pool) external
```

_Executes a default, supplying first-loss to cover losses._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | Pool liquidity asset |
| firstLossVault | address | Vault holding first-loss capital |
| loan | address | Address of loan in default |
| pool | address | Address of the pool |

### calculateCurrentWithdrawPeriod

```solidity
function calculateCurrentWithdrawPeriod(uint256 currentTimestamp, uint256 activatedAt, uint256 withdrawalWindowDuration) public pure returns (uint256)
```

_The current withdrawal period. Withdraw Requests made prior to this
window are eligible to be included in the withdrawal flows._

### progressWithdrawState

```solidity
function progressWithdrawState(struct IPoolWithdrawState state, uint256 currentPeriod) public pure returns (struct IPoolWithdrawState)
```

### calculateWithdrawStateForRequest

```solidity
function calculateWithdrawStateForRequest(struct IPoolWithdrawState state, uint256 currentPeriod, uint256 requestedShares) public pure returns (struct IPoolWithdrawState updatedState)
```

_Calculate the current IPoolWithdrawState based on the existing
request state and the current request period._

### calculateWithdrawStateForCancellation

```solidity
function calculateWithdrawStateForCancellation(struct IPoolWithdrawState state, uint256 currentPeriod, uint256 cancelledShares) public pure returns (struct IPoolWithdrawState updatedState)
```

_Calculate the current IPoolWithdrawState based on the existing
request state and the current request period._

### calculateRequestFee

```solidity
function calculateRequestFee(uint256 shares, uint256 requestFeeBps) public pure returns (uint256)
```

_Calculate the fee for making a withdrawRequest or a redeemRequest.
Per the EIP-4626 spec, this method rounds up._

### calculateCancellationFee

```solidity
function calculateCancellationFee(uint256 shares, uint256 requestCancellationFeeBps) public pure returns (uint256)
```

_Calculate the fee for cancelling a withdrawRequest or a redeemRequest.
Per the EIP-4626 spec, this method rounds up._

### calculateMaxRedeemRequest

```solidity
function calculateMaxRedeemRequest(struct IPoolWithdrawState state, uint256 shareBalance, uint256 requestFeeBps) public pure returns (uint256)
```

_Calculates the Maximum amount of shares that can be requested_

### calculateMaxCancellation

```solidity
function calculateMaxCancellation(struct IPoolWithdrawState state, uint256 requestCancellationFeeBps) public pure returns (uint256)
```

_Calculates the Maximum amount of shares that can be cancelled
from the current withdraw request._

### updateWithdrawStateForWithdraw

```solidity
function updateWithdrawStateForWithdraw(struct IPoolWithdrawState state, uint256 assets, uint256 shares) public pure returns (struct IPoolWithdrawState)
```

@dev

