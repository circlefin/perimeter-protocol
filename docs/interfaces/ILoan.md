# Solidity API

## ILoanLifeCycleState

```solidity
enum ILoanLifeCycleState {
  Requested,
  Collateralized,
  Canceled,
  Defaulted,
  Funded,
  Matured,
  Active,
  Callback
}
```

## ILoanType

```solidity
enum ILoanType {
  Fixed,
  Open
}
```

## ILoanNonFungibleCollateral

```solidity
struct ILoanNonFungibleCollateral {
  address asset;
  uint256 tokenId;
}
```

## ILoanSettings

```solidity
struct ILoanSettings {
  enum ILoanType loanType;
  uint256 principal;
  uint256 apr;
  uint256 duration;
  uint256 paymentPeriod;
  uint256 dropDeadTimestamp;
  uint256 latePayment;
  uint256 originationBps;
}
```

## ILoanFees

```solidity
struct ILoanFees {
  uint256 interestPayment;
  uint256 firstLossFee;
  uint256 serviceFee;
  uint256 originationFee;
  uint256 latePaymentFee;
  uint256 payment;
}
```

## ILoan

### LoanFunded

```solidity
event LoanFunded(address asset, uint256 amount)
```

_Emitted when loan is funded._

### LoanDrawnDown

```solidity
event LoanDrawnDown(address asset, uint256 amount)
```

_Emitted when the loan is drawn down._

### LifeCycleStateTransition

```solidity
event LifeCycleStateTransition(enum ILoanLifeCycleState state)
```

_Emitted when a Loan's lifecycle state transitions_

### PostedCollateral

```solidity
event PostedCollateral(address asset, uint256 amount)
```

_Emitted when collateral is posted to the loan._

### PostedNonFungibleCollateral

```solidity
event PostedNonFungibleCollateral(address asset, uint256 tokenId)
```

_Emitted when collateral is posted to the loan._

### WithdrewCollateral

```solidity
event WithdrewCollateral(address asset, uint256 amount)
```

_Emitted when collateral is withdrawn from the loan._

### WithdrewNonFungibleCollateral

```solidity
event WithdrewNonFungibleCollateral(address asset, uint256 tokenId)
```

_Emitted when collateral is posted to the loan._

### CanceledLoanPrincipalReturned

```solidity
event CanceledLoanPrincipalReturned(address pool, uint256 principal)
```

_Emitted when a loan is canceled and principal returned to the pool._

### state

```solidity
function state() external view returns (enum ILoanLifeCycleState)
```

### borrower

```solidity
function borrower() external view returns (address)
```

### pool

```solidity
function pool() external view returns (address)
```

### factory

```solidity
function factory() external view returns (address)
```

### dropDeadTimestamp

```solidity
function dropDeadTimestamp() external view returns (uint256)
```

### cancelRequested

```solidity
function cancelRequested() external returns (enum ILoanLifeCycleState)
```

### cancelCollateralized

```solidity
function cancelCollateralized() external returns (enum ILoanLifeCycleState)
```

### cancelFunded

```solidity
function cancelFunded() external returns (enum ILoanLifeCycleState)
```

_Allows borrower to PM to cancel a Funded loan, after the dropdead date.
This cancels a loan, allowing collateral to be returned and principal reclaimed to
the pool._

### paymentsRemaining

```solidity
function paymentsRemaining() external view returns (uint256)
```

_Number of payments remaining_

### payment

```solidity
function payment() external view returns (uint256)
```

_Amount expected in each payment_

### paymentDueDate

```solidity
function paymentDueDate() external view returns (uint256)
```

_Due date for the next payment_

### postFungibleCollateral

```solidity
function postFungibleCollateral(address asset, uint256 amount) external returns (enum ILoanLifeCycleState)
```

### fungibleCollateral

```solidity
function fungibleCollateral() external view returns (address[])
```

### postNonFungibleCollateral

```solidity
function postNonFungibleCollateral(address asset, uint256 tokenId) external returns (enum ILoanLifeCycleState)
```

### nonFungibleCollateral

```solidity
function nonFungibleCollateral() external view returns (struct ILoanNonFungibleCollateral[])
```

### claimCollateral

```solidity
function claimCollateral(address[] assets, struct ILoanNonFungibleCollateral[] nonFungibleAssets) external
```

### fund

```solidity
function fund() external returns (enum ILoanLifeCycleState)
```

### drawdown

```solidity
function drawdown(uint256 amount) external returns (uint256)
```

### createdAt

```solidity
function createdAt() external returns (uint256)
```

### duration

```solidity
function duration() external returns (uint256)
```

### paymentPeriod

```solidity
function paymentPeriod() external view returns (uint256)
```

### loanType

```solidity
function loanType() external returns (enum ILoanType)
```

### apr

```solidity
function apr() external returns (uint256)
```

### principal

```solidity
function principal() external returns (uint256)
```

### outstandingPrincipal

```solidity
function outstandingPrincipal() external view returns (uint256)
```

### fundingVault

```solidity
function fundingVault() external returns (contract FundingVault)
```

### markDefaulted

```solidity
function markDefaulted() external returns (enum ILoanLifeCycleState)
```

### markCallback

```solidity
function markCallback() external
```

### liquidityAsset

```solidity
function liquidityAsset() external view returns (address)
```

