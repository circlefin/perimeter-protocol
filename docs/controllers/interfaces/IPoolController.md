# Solidity API

## IPoolLifeCycleState

```solidity
enum IPoolLifeCycleState {
  Initialized,
  Active,
  Paused,
  Closed
}
```

## IPoolConfigurableSettings

```solidity
struct IPoolConfigurableSettings {
  uint256 maxCapacity;
  uint256 endDate;
  uint256 requestFeeBps;
  uint256 requestCancellationFeeBps;
  uint256 withdrawGateBps;
  uint256 serviceFeeBps;
  uint256 firstLossInitialMinimum;
  uint256 withdrawRequestPeriodDuration;
  uint256 fixedFee;
  uint256 fixedFeeInterval;
}
```

## IPoolController

### PoolSettingsUpdated

```solidity
event PoolSettingsUpdated()
```

_Emitted when pool settings are updated._

### LifeCycleStateTransition

```solidity
event LifeCycleStateTransition(enum IPoolLifeCycleState state)
```

_Emitted when the pool transitions a lifecycle state._

### LoanDefaulted

```solidity
event LoanDefaulted(address loan)
```

_Emitted when a funded loan is marked as in default._

### FirstLossApplied

```solidity
event FirstLossApplied(address loan, uint256 amount)
```

_Emitted when first loss capital is used to cover loan defaults_

### admin

```solidity
function admin() external view returns (address)
```

### settings

```solidity
function settings() external view returns (struct IPoolConfigurableSettings)
```

_The current configurable pool settings._

### setServiceFeeBps

```solidity
function setServiceFeeBps(uint256) external
```

_Allow the current pool admin to update the service fee._

### setFixedFee

```solidity
function setFixedFee(uint256 amount, uint256 interval) external
```

_Allow the current pool admin to update the fixed fee._

### setRequestFee

```solidity
function setRequestFee(uint256) external
```

_Allow the current pool admin to update the pool fees
before the pool has been activated._

### requestFee

```solidity
function requestFee(uint256) external view returns (uint256)
```

_Returns the redeem fee for a given withdrawal amount at the current block.
The fee is the number of shares that will be charged._

### setRequestCancellationFee

```solidity
function setRequestCancellationFee(uint256) external
```

_Allow the current pool admin to update the pool cancellation fees
before the pool has been activated._

### requestCancellationFee

```solidity
function requestCancellationFee(uint256) external view returns (uint256)
```

_Returns the cancellation fee for a given withdrawal request at the
current block. The fee is the number of shares that will be charged._

### setWithdrawGate

```solidity
function setWithdrawGate(uint256) external
```

_Allow the current pool admin to update the withdraw gate at any
time if the pool is Initialized or Active_

### withdrawGate

```solidity
function withdrawGate() external view returns (uint256)
```

_Returns the current withdraw gate in bps. If the pool is closed,
this is set to 10_000 (100%)_

### withdrawRequestPeriodDuration

```solidity
function withdrawRequestPeriodDuration() external view returns (uint256)
```

_Returns the current withdraw request period duration in seconds. If the pool is closed,
this is lowered (if needed) to 1 day._

### setPoolCapacity

```solidity
function setPoolCapacity(uint256) external
```

@dev

### setPoolEndDate

```solidity
function setPoolEndDate(uint256) external
```

@dev

### firstLossVault

```solidity
function firstLossVault() external view returns (address)
```

_The current amount of first loss available to the pool_

### firstLossBalance

```solidity
function firstLossBalance() external view returns (uint256)
```

_The current amount of first loss available to the pool_

### state

```solidity
function state() external view returns (enum IPoolLifeCycleState)
```

_Returns the current pool lifecycle state._

### isInitializedOrActive

```solidity
function isInitializedOrActive() external view returns (bool)
```

_Returns true if the pool is in an active or initialized state_

### isActiveOrClosed

```solidity
function isActiveOrClosed() external view returns (bool)
```

_Returns true if the pool is in an active or closed state_

### depositFirstLoss

```solidity
function depositFirstLoss(uint256 amount, address spender) external
```

_Deposits first-loss to the pool. Can only be called by the Pool Admin._

### withdrawFirstLoss

```solidity
function withdrawFirstLoss(uint256 amount, address receiver) external returns (uint256)
```

_Withdraws first-loss from the pool. Can only be called by the Pool Admin._

### fundLoan

```solidity
function fundLoan(address) external
```

_Called by the pool admin, this transfers liquidity from the pool to a given loan._

### defaultLoan

```solidity
function defaultLoan(address) external
```

_Called by the pool admin, this marks a loan as in default, triggering liquiditation
proceedings and updating pool accounting._

### claimFixedFee

```solidity
function claimFixedFee() external
```

_Called by the pool admin, this claims a fixed fee from the pool. Fee can only be
claimed once every interval, as set on the pool._

### crank

```solidity
function crank() external
```

_Cranks the Pool._

