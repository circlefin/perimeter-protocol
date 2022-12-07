# Solidity API

## Loan

### RAY

```solidity
uint256 RAY
```

### _serviceConfiguration

```solidity
contract IServiceConfiguration _serviceConfiguration
```

### _factory

```solidity
address _factory
```

### _state

```solidity
enum ILoanLifeCycleState _state
```

### _borrower

```solidity
address _borrower
```

### _pool

```solidity
address _pool
```

### _collateralVault

```solidity
contract CollateralVault _collateralVault
```

### fundingVault

```solidity
contract FundingVault fundingVault
```

### _fungibleCollateral

```solidity
address[] _fungibleCollateral
```

### _nonFungibleCollateral

```solidity
struct ILoanNonFungibleCollateral[] _nonFungibleCollateral
```

### createdAt

```solidity
uint256 createdAt
```

### liquidityAsset

```solidity
address liquidityAsset
```

### payment

```solidity
uint256 payment
```

_Amount expected in each payment_

### outstandingPrincipal

```solidity
uint256 outstandingPrincipal
```

### paymentsRemaining

```solidity
uint256 paymentsRemaining
```

_Number of payments remaining_

### paymentDueDate

```solidity
uint256 paymentDueDate
```

_Due date for the next payment_

### callbackTimestamp

```solidity
uint256 callbackTimestamp
```

### settings

```solidity
struct ILoanSettings settings
```

### FundsReclaimed

```solidity
event FundsReclaimed(uint256 amount, address pool)
```

### atState

```solidity
modifier atState(enum ILoanLifeCycleState state_)
```

_Modifier that requires the Loan be in the given `state_`_

### onlyPool

```solidity
modifier onlyPool()
```

_Modifier that requires `msg.sender` to be the pool. Loan assumes the pool has performed access checks_

### onlyPoolController

```solidity
modifier onlyPoolController()
```

_Modifier that requires `msg.sender` to be the pool controller._

### onlyBorrower

```solidity
modifier onlyBorrower()
```

_Modifier that requires `msg.sender` be the borrower._

### onlyPoolAdmin

```solidity
modifier onlyPoolAdmin()
```

### onlyPermittedBorrower

```solidity
modifier onlyPermittedBorrower()
```

_Modifier that can be overriden by derived classes to enforce
access control._

### onlyNonTerminalState

```solidity
modifier onlyNonTerminalState()
```

_Modifier that requires the loan not be in a terminal state._

### initialize

```solidity
function initialize(address serviceConfiguration, address factory_, address borrower_, address pool_, address liquidityAsset_, struct ILoanSettings settings_) public virtual
```

### cancelRequested

```solidity
function cancelRequested() external returns (enum ILoanLifeCycleState)
```

_Cancel the Loan_

### cancelCollateralized

```solidity
function cancelCollateralized() external returns (enum ILoanLifeCycleState)
```

_Cancel the Loan and return any collateral_

### cancelFunded

```solidity
function cancelFunded() external returns (enum ILoanLifeCycleState)
```

_Allows borrower to PM to cancel a Funded loan, after the dropdead date.
This cancels a loan, allowing collateral to be returned and principal reclaimed to
the pool._

### claimCollateral

```solidity
function claimCollateral(address[] assets, struct ILoanNonFungibleCollateral[] nonFungibleAssets) external
```

_Claims specific collateral types. Can be called by the borrower
(when Canceled or Matured) or by the PA (when Defaulted)_

### postFungibleCollateral

```solidity
function postFungibleCollateral(address asset, uint256 amount) external virtual returns (enum ILoanLifeCycleState)
```

_Post ERC20 tokens as collateral_

### fungibleCollateral

```solidity
function fungibleCollateral() external view returns (address[])
```

### postNonFungibleCollateral

```solidity
function postNonFungibleCollateral(address asset, uint256 tokenId) external virtual returns (enum ILoanLifeCycleState)
```

_Post ERC721 tokens as collateral_

### nonFungibleCollateral

```solidity
function nonFungibleCollateral() external view returns (struct ILoanNonFungibleCollateral[])
```

### fund

```solidity
function fund() external returns (enum ILoanLifeCycleState)
```

_Fund the Loan
Can only be called by the pool_

### reclaimFunds

```solidity
function reclaimFunds(uint256 amount) external
```

_Pool administrators can reclaim funds in open term loans._

### drawdown

```solidity
function drawdown(uint256 amount) external virtual returns (uint256)
```

_Drawdown the Loan_

### paydownPrincipal

```solidity
function paydownPrincipal(uint256 amount) external
```

_Prepay principal.
Only callable by open term loans_

### completeNextPayment

```solidity
function completeNextPayment() external returns (uint256)
```

_Complete the next payment according to loan schedule inclusive of all fees._

### previewFees

```solidity
function previewFees(uint256 amount) public view returns (struct ILoanFees)
```

_Preview fees for a given interest payment amount._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | allows previewing the fee for a full or prorated payment. |

### completeFullPayment

```solidity
function completeFullPayment() external returns (uint256)
```

_Complete the final payment of the loan._

### markDefaulted

```solidity
function markDefaulted() external returns (enum ILoanLifeCycleState)
```

### markCallback

```solidity
function markCallback() external
```

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

### duration

```solidity
function duration() external view returns (uint256)
```

### paymentPeriod

```solidity
function paymentPeriod() external view returns (uint256)
```

### apr

```solidity
function apr() external view returns (uint256)
```

### principal

```solidity
function principal() external view returns (uint256)
```

### loanType

```solidity
function loanType() external view returns (enum ILoanType)
```

