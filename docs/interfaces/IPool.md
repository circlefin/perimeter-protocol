# Solidity API

## IPoolAccountings

```solidity
struct IPoolAccountings {
  uint256 outstandingLoanPrincipals;
  uint256 fixedFeeDueDate;
  uint256 totalAssetsDeposited;
  uint256 totalAssetsWithdrawn;
  uint256 totalDefaults;
  uint256 totalFirstLossApplied;
}
```

## IPool

### LoanFunded

```solidity
event LoanFunded(address loan, uint256 amount)
```

_Emitted when a loan is funded from the pool._

### LoanMatured

```solidity
event LoanMatured(address loan)
```

_Emitted when a funded loan matures._

### RequestFeePaid

```solidity
event RequestFeePaid(address lender, uint256 feeShares)
```

_Emitted when a redeem fee is paid._

### WithdrawRequested

```solidity
event WithdrawRequested(address lender, uint256 assets, uint256 shares)
```

_Emitted when a withdrawal is requested._

### WithdrawRequestCancelled

```solidity
event WithdrawRequestCancelled(address lender, uint256 assets, uint256 shares)
```

_Emitted when a withdrawal is requested._

### PoolCranked

```solidity
event PoolCranked(uint256 withDrawPeriod, uint256 redeemableShares, uint256 withdrawableAssets)
```

_Emitted when the pool is cranked for a given withdraw period._

### poolController

```solidity
function poolController() external view returns (contract IPoolController)
```

_The PoolController contract_

### withdrawController

```solidity
function withdrawController() external view returns (contract IWithdrawController)
```

_The WithdrawController contract_

### settings

```solidity
function settings() external view returns (struct IPoolConfigurableSettings settings)
```

_The current configurable pool settings._

### state

```solidity
function state() external view returns (enum IPoolLifeCycleState)
```

_The current pool state._

### admin

```solidity
function admin() external view returns (address)
```

_The admin for the pool._

### feeVault

```solidity
function feeVault() external view returns (address)
```

_The address of the fee vault._

### firstLossVault

```solidity
function firstLossVault() external view returns (address)
```

_The first loss vault_

### accountings

```solidity
function accountings() external view returns (struct IPoolAccountings)
```

_The pool accounting variables;_

### activatedAt

```solidity
function activatedAt() external view returns (uint256)
```

_The activation timestamp of the pool._

### serviceFeeBps

```solidity
function serviceFeeBps() external view returns (uint256)
```

_The pool fee, in bps, taken from each interest payment_

### requestRedeem

```solidity
function requestRedeem(uint256) external returns (uint256)
```

_Submits a withdrawal request, incurring a fee._

### requestWithdraw

```solidity
function requestWithdraw(uint256) external returns (uint256)
```

_Submits a withdrawal request, incurring a fee._

### liquidityPoolAssets

```solidity
function liquidityPoolAssets() external view returns (uint256)
```

_The sum of all assets available in the liquidity pool, excluding
any assets that are marked for withdrawal._

### onActivated

```solidity
function onActivated() external
```

_Callback from the pool controller when the pool is activated_

### crank

```solidity
function crank() external
```

_Cranks the pool's withdrawals_

### activeLoans

```solidity
function activeLoans() external view returns (address[])
```

_Returns the set of currently Active loans._

### isActiveLoan

```solidity
function isActiveLoan(address addr) external view returns (bool)
```

_Returns whether a loan is an active Pool loan._

### numActiveLoans

```solidity
function numActiveLoans() external view returns (uint256)
```

_Returns whether a loan is an active Pool loan._

### fundLoan

```solidity
function fundLoan(address) external
```

_Fund a loan, add it to the funded loans list and increment the
outstanding principal balance. Only callable by the Pool Controller_

### onLoanPrincipalReturned

```solidity
function onLoanPrincipalReturned(uint256 amount) external
```

_Called by a loan, it notifies the pool that the loan has returned
principal to the pool._

### onLoanStateTransitioned

```solidity
function onLoanStateTransitioned() external
```

_Called by a loan, it notifies the pool that the loan has transitioned stated._

### onLoanDefaulted

```solidity
function onLoanDefaulted(address loan, uint256 firstLossApplied) external
```

_Called by the PoolController, notifies the Pool that a loan has been defaulted._

### claimFixedFee

```solidity
function claimFixedFee(address, uint256, uint256) external
```

_Called by the Pool Controller, it transfers the fixed fee_

### totalAvailableAssets

```solidity
function totalAvailableAssets() external view returns (uint256)
```

_Calculate the total amount of underlying assets held by the vault,
excluding any assets due for withdrawal._

### totalAvailableSupply

```solidity
function totalAvailableSupply() external view returns (uint256)
```

_The total available supply that is not marked for withdrawal_

### currentExpectedInterest

```solidity
function currentExpectedInterest() external view returns (uint256 interest)
```

_The accrued interest at the current block._

