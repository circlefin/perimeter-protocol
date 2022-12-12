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

## FeeVault

### pool

```solidity
address pool
```

### onlyPoolAdmin

```solidity
modifier onlyPoolAdmin()
```

### constructor

```solidity
constructor(address pool_) public
```

### withdraw

```solidity
function withdraw(address asset, uint256 amount) external
```

_Allows withdrawal of fees held by vault._

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

## Loan

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

### onlyNotPaused

```solidity
modifier onlyNotPaused()
```

_Modifier that requires the protocol not be paused._

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
function initialize(address serviceConfiguration_, address factory_, address borrower_, address pool_, address liquidityAsset_, struct ILoanSettings settings_) public virtual
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

### serviceConfiguration

```solidity
function serviceConfiguration() external view returns (contract IServiceConfiguration)
```

## LoanFactory

### _isLoan

```solidity
mapping(address => bool) _isLoan
```

_Mapping of created loans_

### constructor

```solidity
constructor(address serviceConfiguration) public
```

### createLoan

```solidity
function createLoan(address borrower, address pool, address liquidityAsset, struct ILoanSettings settings) public returns (address LoanAddress)
```

_Creates a Loan
Emits `LoanCreated` event._

### initializeLoan

```solidity
function initializeLoan(address borrower, address pool, address liquidityAsset, struct ILoanSettings settings) internal virtual returns (address)
```

_Internal initialization of Beacon proxy for Loans_

### isLoan

```solidity
function isLoan(address loan) public view returns (bool)
```

_Checks whether the address corresponds to a created loan for this factory_

## Pool

### _serviceConfiguration

```solidity
contract IServiceConfiguration _serviceConfiguration
```

### _liquidityAsset

```solidity
contract IERC20Upgradeable _liquidityAsset
```

### _feeVault

```solidity
contract FeeVault _feeVault
```

### _accountings

```solidity
struct IPoolAccountings _accountings
```

### withdrawController

```solidity
contract IWithdrawController withdrawController
```

_The WithdrawController contract_

### poolController

```solidity
contract IPoolController poolController
```

_The PoolController contract_

### _activeLoans

```solidity
struct EnumerableSet.AddressSet _activeLoans
```

_list of all active loan addresses for this Pool. Active loans have been
drawn down, and the payment schedule activated._

### _fundedLoans

```solidity
mapping(address => bool) _fundedLoans
```

_Mapping of funded loan addresses._

### activatedAt

```solidity
uint256 activatedAt
```

_The activation timestamp of the pool._

### onlyPoolController

```solidity
modifier onlyPoolController()
```

_Modifier to ensure only the PoolController calls a method._

### onlyLender

```solidity
modifier onlyLender()
```

_Modifier that checks that the caller is a pool lender_

### onlyActivatedPool

```solidity
modifier onlyActivatedPool()
```

_Modifier to check that the pool has ever been activated_

### onlyNotPaused

```solidity
modifier onlyNotPaused()
```

_Modifier to check that the protocol is not paused_

### atState

```solidity
modifier atState(enum IPoolLifeCycleState state_)
```

_Modifier that checks that the pool is Initialized or Active_

### onlyCrankedPool

```solidity
modifier onlyCrankedPool()
```

_Modifier to ensure the Pool is cranked._

### onlyPermittedLender

```solidity
modifier onlyPermittedLender()
```

_Modifier that can be overriden by derived classes to enforce
access control._

### initialize

```solidity
function initialize(address liquidityAsset, address poolAdmin, address serviceConfiguration_, address withdrawControllerFactory, address poolControllerFactory, struct IPoolConfigurableSettings poolSettings, string tokenName, string tokenSymbol) public
```

_Initializer for Pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityAsset | address | asset held by the poo |
| poolAdmin | address | admin of the pool |
| serviceConfiguration_ | address | address of global service configuration |
| withdrawControllerFactory | address | factory address of the withdraw controller |
| poolControllerFactory | address |  |
| poolSettings | struct IPoolConfigurableSettings | configurable settings for the pool |
| tokenName | string | Name used for issued pool tokens |
| tokenSymbol | string | Symbol used for issued pool tokens |

### serviceConfiguration

```solidity
function serviceConfiguration() public view returns (contract IServiceConfiguration)
```

_The ServiceConfiguration._

### settings

```solidity
function settings() public view returns (struct IPoolConfigurableSettings poolSettings)
```

_The current configurable pool settings._

### state

```solidity
function state() public view returns (enum IPoolLifeCycleState)
```

_The current pool state._

### admin

```solidity
function admin() external view returns (address)
```

_The admin of the pool_

### feeVault

```solidity
function feeVault() external view returns (address)
```

_The address of the fee vault._

### firstLossVault

```solidity
function firstLossVault() public view returns (address)
```

_The first loss vault_

### accountings

```solidity
function accountings() external view returns (struct IPoolAccountings)
```

_The pool accounting variables;_

### serviceFeeBps

```solidity
function serviceFeeBps() external view returns (uint256)
```

_The fee_

### onActivated

```solidity
function onActivated() external
```

_Callback from the pool controller when the pool is activated_

### fundLoan

```solidity
function fundLoan(address addr) external
```

_Fund a loan, add it to the funded loans list and increment the
outstanding principal balance. Only callable by the Pool Controller_

### activeLoans

```solidity
function activeLoans() external view returns (address[])
```

_Returns the set of currently Active loans._

### isActiveLoan

```solidity
function isActiveLoan(address loan) external view returns (bool)
```

_Returns whether a loan is an active Pool loan._

### numActiveLoans

```solidity
function numActiveLoans() external view returns (uint256)
```

_Returns whether a loan is an active Pool loan._

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

### totalAvailableAssets

```solidity
function totalAvailableAssets() public view returns (uint256 assets)
```

_Calculate the total amount of underlying assets held by the vault,
excluding any assets due for withdrawal._

### totalAvailableSupply

```solidity
function totalAvailableSupply() public view returns (uint256 shares)
```

_The total available supply that is not marked for withdrawal_

### currentExpectedInterest

```solidity
function currentExpectedInterest() external view returns (uint256)
```

_The accrued interest at the current block._

### liquidityPoolAssets

```solidity
function liquidityPoolAssets() public view returns (uint256 assets)
```

_The sum of all assets available in the liquidity pool, excluding
any assets that are marked for withdrawal._

### claimFixedFee

```solidity
function claimFixedFee(address recipient, uint256 fixedFee, uint256 fixedFeeInterval) external
```

### maxRedeemRequest

```solidity
function maxRedeemRequest(address owner) public view returns (uint256 maxShares)
```

_Returns the maximum number of `shares` that can be
requested to be redeemed from the owner balance with a single
`requestRedeem` call in the current block.

Note: This is equivalent of EIP-4626 `maxRedeem`_

### maxWithdrawRequest

```solidity
function maxWithdrawRequest(address owner) public view returns (uint256 maxAssets)
```

_Returns the maximum amount of underlying `assets` that can be
requested to be withdrawn from the owner balance with a single
`requestWithdraw` call in the current block.

Note: This is equivalent of EIP-4626 `maxWithdraw`_

### previewRedeemRequest

```solidity
function previewRedeemRequest(uint256 shares) external view returns (uint256 assets)
```

_Simulate the effects of a redeem request at the current block.
Returns the amount of underlying assets that would be requested if this
entire redeem request were to be processed at the current block.

Note: This is equivalent of EIP-4626 `previewRedeem`_

### previewWithdrawRequest

```solidity
function previewWithdrawRequest(uint256 assets) external view returns (uint256 shares)
```

_Simulate the effects of a withdrawal request at the current block.
Returns the amount of `shares` that would be burned if this entire
withdrawal request were to be processed at the current block.

Note: This is equivalent of EIP-4626 `previewWithdraw`_

### requestRedeem

```solidity
function requestRedeem(uint256 shares) external returns (uint256 assets)
```

_Request a redemption of a number of shares from the pool_

### requestWithdraw

```solidity
function requestWithdraw(uint256 assets) external returns (uint256 shares)
```

_Request a Withdraw of a number of assets from the pool_

### _performRedeemRequest

```solidity
function _performRedeemRequest(address owner, uint256 shares, uint256 assets) internal
```

_Request a redemption of shares from the pool.

Emits a {WithdrawRequested} event._

### maxRequestCancellation

```solidity
function maxRequestCancellation(address owner) public view returns (uint256 maxShares)
```

_Returns the maximum number of `shares` that can be
cancelled from being requested for a redemption.

Note: This is equivalent of EIP-4626 `maxRedeem`_

### cancelRedeemRequest

```solidity
function cancelRedeemRequest(uint256 shares) external returns (uint256 assets)
```

_Cancels a redeem request for a specific number of `shares` from
owner and returns an estimated amnount of underlying that equates to
this number of shares.

Emits a {WithdrawRequestCancelled} event._

### cancelWithdrawRequest

```solidity
function cancelWithdrawRequest(uint256 assets) external returns (uint256 shares)
```

_Cancels a withdraw request for a specific values of `assets` from
owner and returns an estimated number of shares that equates to
this number of assets.

Emits a {WithdrawRequestCancelled} event._

### _performRequestCancellation

```solidity
function _performRequestCancellation(address owner, uint256 shares, uint256 assets) internal
```

_Cancels a withdraw request for the owner, including paying any fees.
A cancellation can only occur before the_

### crank

```solidity
function crank() public virtual
```

_Cranks the pool's withdrawals_

### _crank

```solidity
function _crank() internal
```

_Internal crank function run lazily._

### asset

```solidity
function asset() public view returns (address)
```

_Return the address of the underlying ERC-20 token used for the vault for accounting, depositing, withdrawing._

### totalAssets

```solidity
function totalAssets() public view returns (uint256)
```

_Calculate the total amount of underlying assets held by the vault.
NOTE: This method includes assets that are marked for withdrawal._

### convertToShares

```solidity
function convertToShares(uint256 assets) public view returns (uint256 shares)
```

_Calculates the amount of shares that would be exchanged by the vault for the amount of assets provided.
Rounds DOWN per EIP4626._

### convertToAssets

```solidity
function convertToAssets(uint256 shares) public view returns (uint256 assets)
```

_Calculates the amount of assets that would be exchanged by the vault for the amount of shares provided.
Rounds DOWN per EIP4626._

### maxDeposit

```solidity
function maxDeposit(address) public view virtual returns (uint256)
```

_Calculates the maximum amount of underlying assets that can be deposited in a single deposit call by the receiver._

### previewDeposit

```solidity
function previewDeposit(uint256 assets) public view returns (uint256 shares)
```

_Allows users to simulate the effects of their deposit at the current block.
Rounds DOWN per EIP4626_

### deposit

```solidity
function deposit(uint256 assets, address receiver) public virtual returns (uint256 shares)
```

_Deposits assets of underlying tokens into the vault and grants ownership of shares to receiver.
Emits a {Deposit} event._

### maxMint

```solidity
function maxMint(address receiver) public view virtual returns (uint256)
```

_Returns the maximum amount of shares that can be minted in a single mint call by the receiver._

### previewMint

```solidity
function previewMint(uint256 shares) public view returns (uint256 assets)
```

_Allows users to simulate the effects of their mint at the current block.
Rounds UP per EIP4626, to determine the number of assets to be provided for shares._

### mint

```solidity
function mint(uint256 shares, address receiver) public virtual returns (uint256 assets)
```

_Mints exactly shares vault shares to receiver by depositing assets of underlying tokens.
Emits a {Deposit} event._

### maxWithdraw

```solidity
function maxWithdraw(address owner) public view returns (uint256 assets)
```

_Returns the maximum amount of underlying assets that can be withdrawn from the owner balance with a single withdraw call._

### previewWithdraw

```solidity
function previewWithdraw(uint256 assets) external view returns (uint256 shares)
```

_Simulate the effects of their withdrawal at the current block.
Per EIP4626, should round UP on the number of shares required for assets._

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) public virtual returns (uint256 shares)
```

_Burns shares from owner and send exactly assets token from the vault to receiver.
Emits a {Withdraw} event.
Should round UP for EIP4626._

### maxRedeem

```solidity
function maxRedeem(address owner) public view returns (uint256 maxShares)
```

_The maximum amount of shares that can be redeemed from the owner
balance through a redeem call._

### previewRedeem

```solidity
function previewRedeem(uint256 shares) external view returns (uint256 assets)
```

_Simulates the effects of their redeemption at the current block.
Per EIP4626, should round DOWN._

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) public virtual returns (uint256 assets)
```

_Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.
Emits a {Withdraw} event.
Per EIP4626, should round DOWN._

### _performWithdrawTransfer

```solidity
function _performWithdrawTransfer(address owner, uint256 shares, uint256 assets) internal
```

_Redeem a number of shares for a given number of assets. This method
will transfer `assets` from the vault to the `receiver`, and burn `shares`
from `owner`._

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual
```

_Hook that is called before any transfer of tokens. This includes
minting and burning.

Calling conditions:

- when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
will be transferred to `to`.
- when `from` is zero, `amount` tokens will be minted for `to`.
- when `to` is zero, `amount` of ``from``'s tokens will be burned.
- `from` and `to` are never both zero.

To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks]._

## PoolFactory

### _withdrawControllerFactory

```solidity
address _withdrawControllerFactory
```

_Reference to the WithdrawControllerFactory contract_

### _poolControllerFactory

```solidity
address _poolControllerFactory
```

_Reference to the PoolControllerFactory contract_

### constructor

```solidity
constructor(address serviceConfiguration, address withdrawControllerFactory, address poolControllerFactory) public
```

### createPool

```solidity
function createPool(address liquidityAsset, struct IPoolConfigurableSettings settings) public virtual returns (address poolAddress)
```

_Creates a pool
Emits `PoolCreated` event._

### initializePool

```solidity
function initializePool(address liquidityAsset, struct IPoolConfigurableSettings settings) internal virtual returns (address)
```

_Creates the new Pool contract._

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

### FirstLossDeposited

```solidity
event FirstLossDeposited(address caller, address spender, uint256 amount)
```

_Emitted when first loss is supplied to the pool._

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

## IPoolWithdrawState

```solidity
struct IPoolWithdrawState {
  uint256 requestedShares;
  uint256 eligibleShares;
  uint256 latestRequestPeriod;
  uint256 redeemableShares;
  uint256 withdrawableAssets;
  uint256 latestCrankPeriod;
  uint256 crankOffsetPeriod;
}
```

## IPoolSnapshotState

```solidity
struct IPoolSnapshotState {
  uint256 aggregationSumRay;
  uint256 aggregationSumFxRay;
  uint256 aggregationDifferenceRay;
}
```

## IWithdrawController

### withdrawPeriod

```solidity
function withdrawPeriod() external view returns (uint256)
```

### interestBearingBalanceOf

```solidity
function interestBearingBalanceOf(address) external view returns (uint256)
```

_Returns the amount of shares that should be considered interest
bearing for a given owner.  This number is their balance, minus their
"redeemable" shares._

### requestedBalanceOf

```solidity
function requestedBalanceOf(address) external view returns (uint256)
```

_Returns the number of shares that have been requested to be redeemed
by the owner as of the current block._

### totalRequestedBalance

```solidity
function totalRequestedBalance() external view returns (uint256)
```

_Returns the number of shares that are available to be redeemed by
the owner in the current block._

### eligibleBalanceOf

```solidity
function eligibleBalanceOf(address) external view returns (uint256)
```

_Returns the number of shares owned by an address that are "vested"
enough to be considered for redeeming during the next withdraw period._

### totalEligibleBalance

```solidity
function totalEligibleBalance() external view returns (uint256)
```

_Returns the number of shares overall that are "vested" enough to be
considered for redeeming during the next withdraw period._

### totalRedeemableShares

```solidity
function totalRedeemableShares() external view returns (uint256)
```

_Returns the number of shares that are available to be redeemed
overall in the current block._

### totalWithdrawableAssets

```solidity
function totalWithdrawableAssets() external view returns (uint256)
```

_Returns the number of `assets` that are available to be withdrawn
overall in the current block._

### maxRedeemRequest

```solidity
function maxRedeemRequest(address) external view returns (uint256)
```

_Returns the maximum number of `shares` that can be
requested to be redeemed from the owner balance with a single
`requestRedeem` call in the current block.

Note: This is equivalent of EIP-4626 `maxRedeem`_

### maxRedeem

```solidity
function maxRedeem(address) external view returns (uint256)
```

_The maximum amount of shares that can be redeemed from the owner
balance through a redeem call._

### maxWithdraw

```solidity
function maxWithdraw(address) external view returns (uint256)
```

_Returns the maximum amount of underlying assets that can be
withdrawn from the owner balance with a single withdraw call._

### previewRedeemRequest

```solidity
function previewRedeemRequest(uint256) external view returns (uint256)
```

_Simulate the effects of a redeem request at the current block.
Returns the amount of underlying assets that would be requested if this
entire redeem request were to be processed at the current block.

Note: This is equivalent of EIP-4626 `previewRedeem`_

### previewWithdrawRequest

```solidity
function previewWithdrawRequest(uint256) external view returns (uint256)
```

_Simulate the effects of a withdrawal request at the current block.
Returns the amount of `shares` that would be burned if this entire
withdrawal request were to be processed at the current block.

Note: This is equivalent of EIP-4626 `previewWithdraw`_

### previewRedeem

```solidity
function previewRedeem(address, uint256) external view returns (uint256)
```

_Simulates the effects of their redeemption at the current block.
Per EIP4626, should round DOWN._

### previewWithdraw

```solidity
function previewWithdraw(address, uint256) external view returns (uint256)
```

_Simulate the effects of their withdrawal at the current block.
Per EIP4626, should round UP on the number of shares required for assets._

### performRequest

```solidity
function performRequest(address, uint256) external
```

_Requests redeeming a specific number of `shares` and `assets` from
the pool.

NOTE: The pool is responsible for handling any fees, and for providing
the proper shares/assets ratio._

### maxRequestCancellation

```solidity
function maxRequestCancellation(address) external view returns (uint256)
```

_Returns the maximum number of `shares` that can be
cancelled from being requested for a redemption.

Note: This is equivalent of EIP-4626 `maxRedeem`_

### performRequestCancellation

```solidity
function performRequestCancellation(address, uint256) external
```

_Cancels a withdraw request for the owner,

NOTE This method does not charge fees, as this should be handled outside
of the WithdrawController._

### crank

```solidity
function crank(uint256 withdrawGate) external returns (uint256 period, uint256 shares, uint256 assets, bool periodCranked)
```

_Crank the protocol. Performs accounting for withdrawals_

### redeem

```solidity
function redeem(address, uint256) external returns (uint256)
```

_Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.

Per EIP4626, should round DOWN._

### withdraw

```solidity
function withdraw(address, uint256) external returns (uint256)
```

_Burns shares from owner and send exactly assets token from the vault to receiver.
Should round UP for EIP4626._

## IPoolControllerFactory

### PoolControllerCreated

```solidity
event PoolControllerCreated(address pool, address addr)
```

_Emitted when a pool is created._

### createController

```solidity
function createController(address, address, address, address, struct IPoolConfigurableSettings) external returns (address)
```

_Creates a pool's PoolAdmin controller
Emits `PoolControllerCreated` event._

## IWithdrawControllerFactory

### WithdrawControllerCreated

```solidity
event WithdrawControllerCreated(address addr)
```

_Emitted when a pool is created._

### createController

```solidity
function createController(address) external returns (address)
```

_Creates a pool's withdraw controller
Emits `WithdrawControllerCreated` event._

## IERC4626

### Deposit

```solidity
event Deposit(address caller, address owner, uint256 assets, uint256 shares)
```

_Emitted when tokens are deposited into the vault via the mint and deposit methods._

### Withdraw

```solidity
event Withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
```

_Emitted when shares are withdrawn from the vault by a depositor in the redeem or withdraw methods._

### asset

```solidity
function asset() external view returns (address)
```

_Return the address of the underlying ERC-20 token used for the vault for accounting, depositing, withdrawing._

### totalAssets

```solidity
function totalAssets() external view returns (uint256)
```

_Calculate the total amount of underlying assets held by the vault.
NOTE: This method includes assets that are marked for withdrawal._

### convertToShares

```solidity
function convertToShares(uint256 assets) external view returns (uint256)
```

_Calculates the amount of shares that would be exchanged by the vault for the amount of assets provided._

### convertToAssets

```solidity
function convertToAssets(uint256 shares) external view returns (uint256)
```

_Calculates the amount of assets that would be exchanged by the vault for the amount of shares provided._

### maxDeposit

```solidity
function maxDeposit(address receiver) external view returns (uint256)
```

_Calculates the maximum amount of underlying assets that can be deposited in a single deposit call by the receiver._

### previewDeposit

```solidity
function previewDeposit(uint256 assets) external view returns (uint256)
```

_Allows users to simulate the effects of their deposit at the current block._

### deposit

```solidity
function deposit(uint256 assets, address receiver) external returns (uint256)
```

_Deposits assets of underlying tokens into the vault and grants ownership of shares to receiver.
Emits a {Deposit} event._

### maxMint

```solidity
function maxMint(address receiver) external view returns (uint256)
```

_Returns the maximum amount of shares that can be minted in a single mint call by the receiver._

### previewMint

```solidity
function previewMint(uint256 shares) external view returns (uint256)
```

_Allows users to simulate the effects of their mint at the current block._

### mint

```solidity
function mint(uint256 shares, address receiver) external returns (uint256)
```

_Mints exactly shares vault shares to receiver by depositing assets of underlying tokens.
Emits a {Deposit} event._

### maxWithdraw

```solidity
function maxWithdraw(address owner) external view returns (uint256)
```

_Returns the maximum amount of underlying assets that can be withdrawn from the owner balance with a single withdraw call._

### previewWithdraw

```solidity
function previewWithdraw(uint256 assets) external view returns (uint256)
```

_Simulate the effects of their withdrawal at the current block._

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)
```

_Burns shares from owner and send exactly assets token from the vault to receiver.
Emits a {Withdraw} event._

### maxRedeem

```solidity
function maxRedeem(address owner) external view returns (uint256)
```

_The maximum amount of shares that can be redeemed from the owner balance through a redeem call._

### previewRedeem

```solidity
function previewRedeem(uint256 shares) external view returns (uint256)
```

_Simulates the effects of their redeemption at the current block._

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) external returns (uint256)
```

_Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.
Emits a {Withdraw} event._

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

### serviceConfiguration

```solidity
function serviceConfiguration() external view returns (contract IServiceConfiguration)
```

## ILoanFactory

### LoanCreated

```solidity
event LoanCreated(address addr)
```

_Emitted when a loan is created._

### createLoan

```solidity
function createLoan(address borrower, address pool, address liquidityAsset, struct ILoanSettings settings) external returns (address)
```

_Creates a loan
Emits `LoanCreated` event._

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

### serviceConfiguration

```solidity
function serviceConfiguration() external view returns (contract IServiceConfiguration)
```

_The ServiceConfiguration._

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

## IPoolFactory

### PoolCreated

```solidity
event PoolCreated(address addr)
```

_Emitted when a pool is created._

### createPool

```solidity
function createPool(address, struct IPoolConfigurableSettings) external returns (address)
```

_Creates a pool's PoolAdmin controller
Emits `PoolControllerCreated` event._

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

## LoanLib

### RAY

```solidity
uint256 RAY
```

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

### LoanPrincipalPaid

```solidity
event LoanPrincipalPaid(address asset, uint256 amount, address fundingVault)
```

_Emitted when loan principal is repaid ahead of schedule._

### LoanPaymentMade

```solidity
event LoanPaymentMade(address pool, address liquidityAsset, uint256 amount)
```

_Emitted when a loan payment is made._

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

_See ILoan_

### validateLoan

```solidity
function validateLoan(contract IServiceConfiguration config, uint256 duration, uint256 paymentPeriod, uint256 principal, address liquidityAsset) external view
```

_Validate Loan constructor arguments_

### postFungibleCollateral

```solidity
function postFungibleCollateral(address collateralVault, address asset, uint256 amount, enum ILoanLifeCycleState state, address[] collateral) external returns (enum ILoanLifeCycleState)
```

_Post ERC20 tokens as collateral_

### postNonFungibleCollateral

```solidity
function postNonFungibleCollateral(address collateralVault, address asset, uint256 tokenId, enum ILoanLifeCycleState state, struct ILoanNonFungibleCollateral[] collateral) external returns (enum ILoanLifeCycleState)
```

_Post ERC721 tokens as collateral_

### withdrawFungibleCollateral

```solidity
function withdrawFungibleCollateral(contract CollateralVault collateralVault, address[] collateralToWithdraw) external
```

_Withdraw ERC20 collateral_

### withdrawNonFungibleCollateral

```solidity
function withdrawNonFungibleCollateral(contract CollateralVault collateralVault, struct ILoanNonFungibleCollateral[] collateralToWithdraw) external
```

_Withdraw ERC721 collateral_

### fundLoan

```solidity
function fundLoan(address liquidityAsset, contract FundingVault fundingVault, uint256 amount) public returns (enum ILoanLifeCycleState)
```

Fund a loan

### drawdown

```solidity
function drawdown(uint256 amount, contract FundingVault fundingVault, address receiver, uint256 paymentDueDate, struct ILoanSettings settings, enum ILoanLifeCycleState state) public returns (enum ILoanLifeCycleState, uint256)
```

Drawdown a loan

### paydownPrincipal

```solidity
function paydownPrincipal(address asset, uint256 amount, contract FundingVault fundingVault) external
```

Paydown principal

### completePayment

```solidity
function completePayment(address liquidityAsset, address pool, uint256 amount) public
```

Make a payment

### returnCanceledLoanPrincipal

```solidity
function returnCanceledLoanPrincipal(contract FundingVault fundingVault, address pool, uint256 amount) public
```

Make a payment

### previewFirstLossFee

```solidity
function previewFirstLossFee(uint256 payment, uint256 firstLossFeeBps) public pure returns (uint256)
```

### previewServiceFee

```solidity
function previewServiceFee(uint256 payment, uint256 serviceFeeBps) public pure returns (uint256)
```

### previewOriginationFee

```solidity
function previewOriginationFee(struct ILoanSettings settings, uint256 scalingValue) public pure returns (uint256)
```

### previewLatePaymentFee

```solidity
function previewLatePaymentFee(struct ILoanSettings settings, uint256 blockTimestamp, uint256 paymentDueDate) public pure returns (uint256)
```

### previewFees

```solidity
function previewFees(struct ILoanSettings settings, uint256 payment, uint256 firstLoss, uint256 serviceFeeBps, uint256 blockTimestamp, uint256 paymentDueDate, uint256 scalingValue) public pure returns (struct ILoanFees)
```

_Calculate the fees for a given interest payment._

### payFees

```solidity
function payFees(address asset, address firstLossVault, address feeVault, struct ILoanFees fees) public
```

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
function calculateConversion(uint256 input, uint256 numerator, uint256 denominator, bool roundUp) public pure returns (uint256 output)
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

### calculateSharesFromAssets

```solidity
function calculateSharesFromAssets(uint256 assets, uint256 totalShares, uint256 totalAssets, bool roundUp) external pure returns (uint256)
```

_Calculates the exchange rate for converting assets to shares_

### calculateAssetsFromShares

```solidity
function calculateAssetsFromShares(uint256 shares, uint256 totalAssets, uint256 totalShares, bool roundUp) external pure returns (uint256)
```

_Calculates the exchange rate for converting shares to assets_

### isSolvent

```solidity
function isSolvent(uint256 totalAssets, uint256 totalShares) private pure returns (bool)
```

_Private method to determine if a pool is solvent given
the parameters.

If the pool has assets, it is solvent. If no assets are available,
but no shares have been issued, it is solvent. Otherwise, it is insolvent._

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

## MockVeriteAccessControl

### initialize

```solidity
function initialize() public
```

## MockUpgrade

### foo

```solidity
function foo() external pure returns (bool)
```

## PoolAccessControlMockV2

## PoolAdminAccessControlMockV2

## PermissionedLoan

### poolAccessControl

```solidity
contract IPoolAccessControl poolAccessControl
```

_The reference to the access control contract_

### onlyPermittedBorrower

```solidity
modifier onlyPermittedBorrower()
```

_a modifier to only allow valid borrowers to perform an action_

### initialize

```solidity
function initialize(address serviceConfiguration, address factory_, address borrower_, address pool_, address liquidityAsset_, struct ILoanSettings settings_) public
```

## PermissionedLoanFactory

### constructor

```solidity
constructor(address serviceConfiguration) public
```

### initializeLoan

```solidity
function initializeLoan(address borrower, address pool, address liquidityAsset, struct ILoanSettings settings) internal returns (address)
```

_Deploys BeaconProxy for PermissionedLoan_

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

## PermissionedPoolFactory

### _poolAccessControlFactory

```solidity
address _poolAccessControlFactory
```

_Reference to a PoolAccessControlFactory_

### onlyVerifiedPoolAdmin

```solidity
modifier onlyVerifiedPoolAdmin()
```

_Check that `msg.sender` is a PoolAdmin._

### constructor

```solidity
constructor(address serviceConfiguration, address withdrawControllerFactory, address poolControllerFactory, address poolAccessControlFactory) public
```

### createPool

```solidity
function createPool(address liquidityAsset, struct IPoolConfigurableSettings settings) public returns (address)
```

_Restricts callers to verified PoolAdmins_

### initializePool

```solidity
function initializePool(address liquidityAsset, struct IPoolConfigurableSettings settings) internal returns (address)
```

_Injects access control into the PermissionedPool_

## PoolAccessControl

_Implementation of the {IPoolAccessControl} interface.

This implementation implements a basic Allow-List of addresses, which can
be managed only by the Pool Admin._

### _pool

```solidity
contract IPool _pool
```

_Reference to the pool_

### _tosRegistry

```solidity
contract IToSAcceptanceRegistry _tosRegistry
```

_Reference to the ToS Acceptance Registry_

### _allowedParticipants

```solidity
mapping(address => bool) _allowedParticipants
```

_A mapping of addresses to whether they are allowed to lend or borrower in the pool._

### ParticipantAllowed

```solidity
event ParticipantAllowed(address addr)
```

_Emitted when an address is added from the participant allow list._

### ParticipantRemoved

```solidity
event ParticipantRemoved(address addr)
```

_Emitted when an address is removed from the participant allow list._

### onlyPoolAdmin

```solidity
modifier onlyPoolAdmin()
```

_Modifier that checks that the caller is the pool's admin._

### onlyVeriteAdmin

```solidity
modifier onlyVeriteAdmin()
```

_Modifier to restrict the Verite Access Control logic to pool admins_

### onlyVeriteEligible

```solidity
modifier onlyVeriteEligible()
```

_Modifier to restrict verification to users who have accepted the ToS_

### onlyNotPaused

```solidity
modifier onlyNotPaused()
```

_Modifier that requires the protocol not be paused._

### initialize

```solidity
function initialize(address pool, address tosAcceptanceRegistry) public
```

_The constructor for the PoolAccessControl contract_

### isAllowed

```solidity
function isAllowed(address addr) external view returns (bool)
```

_Check if an address is allowed as a participant in the pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | The address to verify |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether the address is allowed as a participant |

### allowParticipant

```solidity
function allowParticipant(address addr) external
```

_Adds an address to the participant allow list.

Emits an {AllowedParticipantListUpdated} event._

### removeParticipant

```solidity
function removeParticipant(address addr) external
```

_Removes an address from the participant allow list.

Emits an {AllowedParticipantListUpdated} event._

### addTrustedVerifier

```solidity
function addTrustedVerifier(address addr) public
```

_Add a trusted Verifier

Emits a {TrustedVerifierAdded} event._

### removeTrustedVerifier

```solidity
function removeTrustedVerifier(address addr) public
```

_Remove a trusted Verifier

Emits a {TrustedVerifierRemoved} event._

### addCredentialSchema

```solidity
function addCredentialSchema(string schema) public
```

_Add a supported credential schema

Emits a {CredentialSchemaAdded} event._

### removeCredentialSchema

```solidity
function removeCredentialSchema(string schema) public
```

_Remove a supported credential schema

Emits a {CredentialSchemaRemoved} event._

### verify

```solidity
function verify(struct VerificationResult verificationResult, bytes signature) public
```

_Verifies a verification result and adds it to the list of valid
credentials until the expiration time.

A verifier provides a signed hash of a verification result it has created
for a subject address. This function recreates the hash given the result
artifacts and then uses it and the signature to recover the public
address of the signer. If that address is a trusted verifier's signing
address, and the assessment completes within the deadline (unix time in
seconds since epoch), then the verification succeeds and is valid until
revocation, expiration, or removal from storage.

NOTE: This function allows anyone (e.g. a verifier) to submit a
verification result on behalf of other subjects.

Emits a {VerificationResultConfirmed} event._

## PoolAccessControlFactory

### constructor

```solidity
constructor(address serviceConfiguration) public
```

### create

```solidity
function create(address pool) external virtual returns (address)
```

_Creates a new PoolAccessControl._

## PoolAdminAccessControl

_Implementation of the {IPoolAdminAccessControl} interface.

This implementation implements a basic Allow-List of addresses, which can
be managed only by the contract owner._

### _tosRegistry

```solidity
contract IToSAcceptanceRegistry _tosRegistry
```

_Reference to the ToS Acceptance Registry_

### onlyVeriteAdmin

```solidity
modifier onlyVeriteAdmin()
```

_Modifier to restrict the Verite Access Control logic to pool admins_

### onlyVeriteEligible

```solidity
modifier onlyVeriteEligible()
```

_Modifier to restrict verification to users who have accepted the ToS_

### initialize

```solidity
function initialize(address serviceConfiguration) public
```

_Initializer for the contract, which sets the ServiceConfiguration._

### isAllowed

```solidity
function isAllowed(address addr) external view returns (bool)
```

_Checks against an allowList to see if the given address is allowed._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | The address to verify |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether the address is allowed as a Pool Admin |

## VeriteAccessControl

_Implementation of the {IPoolVeriteAccessControl} interface.

Other contracts should inherit this contract to add Verite-specific
access control logic._

### _trustedVerifiers

```solidity
mapping(address => bool) _trustedVerifiers
```

_A mapping of allowed verifiers_

### _supportedCredentialSchemas

```solidity
mapping(string => bool) _supportedCredentialSchemas
```

_A list of supported credential schemas_

### _credentialVerifications

```solidity
mapping(address => uint256) _credentialVerifications
```

_A mapping of address to their latest credential verification timestamp._

### onlyVeriteAdmin

```solidity
modifier onlyVeriteAdmin()
```

_Modifier to restrict access to who can modify the Verite permissions
based on the inheriting contract_

### onlyVeriteEligible

```solidity
modifier onlyVeriteEligible()
```

_Modifier to restrict verifications to end-users who are eligible
for verification (e.g. performed some action to be eligible)_

### addTrustedVerifier

```solidity
function addTrustedVerifier(address addr) public virtual
```

_Add a trusted Verifier

Emits a {TrustedVerifierAdded} event._

### removeTrustedVerifier

```solidity
function removeTrustedVerifier(address addr) public virtual
```

_Remove a trusted Verifier

Emits a {TrustedVerifierRemoved} event._

### addCredentialSchema

```solidity
function addCredentialSchema(string schema) public virtual
```

_Add a supported credential schema

Emits a {CredentialSchemaAdded} event._

### removeCredentialSchema

```solidity
function removeCredentialSchema(string schema) public virtual
```

_Remove a supported credential schema

Emits a {CredentialSchemaRemoved} event._

### __VeriteAccessControl__init

```solidity
function __VeriteAccessControl__init() internal
```

### isVerified

```solidity
function isVerified(address addr) internal view returns (bool)
```

_Check if an address is verified_

### verify

```solidity
function verify(struct VerificationResult verificationResult, bytes signature) public virtual
```

_Verifies a verification result and adds it to the list of valid
credentials until the expiration time.

A verifier provides a signed hash of a verification result it has created
for a subject address. This function recreates the hash given the result
artifacts and then uses it and the signature to recover the public
address of the signer. If that address is a trusted verifier's signing
address, and the assessment completes within the deadline (unix time in
seconds since epoch), then the verification succeeds and is valid until
revocation, expiration, or removal from storage.

NOTE: This function allows anyone (e.g. a verifier) to submit a
verification result on behalf of other subjects.

Emits a {VerificationResultConfirmed} event._

## IPermissionedServiceConfiguration

### poolAdminAccessControl

```solidity
function poolAdminAccessControl() external view returns (contract IPoolAdminAccessControl)
```

_Determine whether the subject address has a verification record that is not expired_

## IPoolAccessControl

### isAllowed

```solidity
function isAllowed(address addr) external view returns (bool)
```

_Check if an address is allowed as a participant in the pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | The address to verify |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether the address is allowed as a participant |

## IPoolAccessControlFactory

### create

```solidity
function create(address pool) external returns (address)
```

_Creates a new PoolAccessControl._

## IPoolAdminAccessControl

### isAllowed

```solidity
function isAllowed(address addr) external view returns (bool)
```

_Check if an address is allowed as a Pool Admin_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address | The address to verify |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | whether the address is allowed as a Pool Admin |

## IToSAcceptanceRegistry

### AcceptanceRecorded

```solidity
event AcceptanceRecorded(address accepter)
```

_Emitted when someone accepts the ToS._

### TermsOfServiceUpdated

```solidity
event TermsOfServiceUpdated()
```

_Emitted when the Terms of Service is updated._

### termsOfService

```solidity
function termsOfService() external view returns (string)
```

_Returns the current TermsOfService URL_

### updateTermsOfService

```solidity
function updateTermsOfService(string url) external
```

_Updates the TermsOfService._

### acceptTermsOfService

```solidity
function acceptTermsOfService() external
```

_Records that msg.sender has accepted the TermsOfService._

### hasAccepted

```solidity
function hasAccepted(address addr) external view returns (bool)
```

_Returns whether an address has accepted the TermsOfService._

## IVeriteAccessControl

### TrustedVerifierAdded

```solidity
event TrustedVerifierAdded(address addr)
```

_Emitted when a new Verifier is added_

### TrustedVerifierRemoved

```solidity
event TrustedVerifierRemoved(address addr)
```

_Emitted when a Verifier is removed_

### CredentialSchemaAdded

```solidity
event CredentialSchemaAdded(string schema)
```

_Emitted when a new credential schema is added_

### CredentialSchemaRemoved

```solidity
event CredentialSchemaRemoved(string schema)
```

_Emitted when a credential schema is removed_

### VerificationResultConfirmed

```solidity
event VerificationResultConfirmed(address addr)
```

_Emitted when an address validate via Verite_

### addTrustedVerifier

```solidity
function addTrustedVerifier(address) external
```

_Add a trusted Verifier

Emits a {TrustedVerifierAdded} event._

### removeTrustedVerifier

```solidity
function removeTrustedVerifier(address) external
```

_Remove a trusted Verifier

Emits a {TrustedVerifierRemoved} event._

### addCredentialSchema

```solidity
function addCredentialSchema(string) external
```

_Add a supported credential schema

Emits a {CredentialSchemaAdded} event._

### removeCredentialSchema

```solidity
function removeCredentialSchema(string) external
```

_Remove a supported credential schema

Emits a {CredentialSchemaRemoved} event._

### verify

```solidity
function verify(struct VerificationResult, bytes) external
```

_Verifies a verification result and adds it to the list of valid
credentials until the expiration time.

A verifier provides a signed hash of a verification result it has created
for a subject address. This function recreates the hash given the result
artifacts and then uses it and the signature to recover the public
address of the signer. If that address is a trusted verifier's signing
address, and the assessment completes within the deadline (unix time in
seconds since epoch), then the verification succeeds and is valid until
revocation, expiration, or removal from storage.

NOTE: This function allows anyone (e.g. a verifier) to submit a
verification result on behalf of other subjects.

Emits a {VerificationResultConfirmed} event._

## VerificationResult

```solidity
struct VerificationResult {
  string schema;
  address subject;
  uint256 expiration;
  string verifier_verification_id;
}
```

## BeaconImplementation

_Base contract that_

### constructor

```solidity
constructor() internal
```

## BeaconProxyFactory

_Base contract for emitting new Beacon proxy contracts._

### _serviceConfiguration

```solidity
contract IServiceConfiguration _serviceConfiguration
```

_Address of the protocol service configuration_

### onlyDeployer

```solidity
modifier onlyDeployer()
```

_Modifier that requires that the sender is registered as a protocol deployer._

### implementation

```solidity
address implementation
```

_Returns an address used by BeaconProxy contracts for delegated calls._

### setImplementation

```solidity
function setImplementation(address newImplementation) external
```

_Updates the implementation._

## DeployerUUPSUpgradeable

_Base upgradeable contract that ensures only the protocol Deployer can deploy
upgrades._

### _serviceConfiguration

```solidity
contract IServiceConfiguration _serviceConfiguration
```

_Address of the protocol service configuration_

### onlyDeployer

```solidity
modifier onlyDeployer()
```

_Modifier that requires that the sender is registered as a protocol deployer._

### constructor

```solidity
constructor() internal
```

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal
```

_Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
{upgradeTo} and {upgradeToAndCall}.

Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.

```solidity
function _authorizeUpgrade(address) internal override onlyOwner {}
```_

## IBeacon

_Interface of Beacon contracts._

### ImplementationSet

```solidity
event ImplementationSet(address implementation)
```

_Emitted when a new implementation is set._

### implementation

```solidity
function implementation() external view returns (address)
```

_Returns an address used by BeaconProxy contracts for delegated calls._

### setImplementation

```solidity
function setImplementation(address implementation) external
```

_Updates the implementation._

## ServiceConfiguration

_Implementation of the {IServiceConfiguration} interface._

### OPERATOR_ROLE

```solidity
bytes32 OPERATOR_ROLE
```

_The Operator Role_

### PAUSER_ROLE

```solidity
bytes32 PAUSER_ROLE
```

_The Pauser Role_

### DEPLOYER_ROLE

```solidity
bytes32 DEPLOYER_ROLE
```

_The Operator Role_

### paused

```solidity
bool paused
```

_Whether the protocol is paused._

### isLiquidityAsset

```solidity
mapping(address => bool) isLiquidityAsset
```

### firstLossMinimum

```solidity
mapping(address => uint256) firstLossMinimum
```

### firstLossFeeBps

```solidity
uint256 firstLossFeeBps
```

### tosAcceptanceRegistry

```solidity
address tosAcceptanceRegistry
```

### protocolFeeBps

```solidity
uint256 protocolFeeBps
```

### isLoanFactory

```solidity
mapping(address => bool) isLoanFactory
```

_Holds a reference to valid LoanFactories_

### AddressSet

```solidity
event AddressSet(bytes32 which, address addr)
```

_Emitted when an address is changed._

### LiquidityAssetSet

```solidity
event LiquidityAssetSet(address addr, bool value)
```

_Emitted when a liquidity asset is set._

### FirstLossMinimumSet

```solidity
event FirstLossMinimumSet(address addr, uint256 value)
```

_Emitted when first loss minimum is set for an asset._

### ParameterSet

```solidity
event ParameterSet(bytes32, uint256 value)
```

_Emitted when a parameter is set._

### ProtocolPaused

```solidity
event ProtocolPaused(bool paused)
```

_Emitted when the protocol is paused._

### LoanFactorySet

```solidity
event LoanFactorySet(address factory, bool isValid)
```

_Emitted when a loan factory is set_

### TermsOfServiceRegistrySet

```solidity
event TermsOfServiceRegistrySet(address registry)
```

_Emitted when the TermsOfServiceRegistry is set_

### onlyOperator

```solidity
modifier onlyOperator()
```

_Modifier that checks that the caller account has the Operator role._

### onlyPauser

```solidity
modifier onlyPauser()
```

_Require the caller be the pauser_

### initialize

```solidity
function initialize() public
```

_Constructor for the contract, which sets up the default roles and
owners._

### setLiquidityAsset

```solidity
function setLiquidityAsset(address addr, bool value) public
```

_Set a liquidity asset as valid or not._

### setPaused

```solidity
function setPaused(bool paused_) public
```

_Pause/unpause the protocol._

### isOperator

```solidity
function isOperator(address addr) external view returns (bool)
```

_Check that `msg.sender` is an Operator._

### isDeployer

```solidity
function isDeployer(address addr) external view returns (bool)
```

_checks if a given address has the Deployer role_

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

## PoolController

### pool

```solidity
contract IPool pool
```

### admin

```solidity
address admin
```

### serviceConfiguration

```solidity
address serviceConfiguration
```

### _settings

```solidity
struct IPoolConfigurableSettings _settings
```

### _state

```solidity
enum IPoolLifeCycleState _state
```

### _firstLossVault

```solidity
contract FirstLossVault _firstLossVault
```

### _liquidityAsset

```solidity
contract IERC20 _liquidityAsset
```

### onlyNotPaused

```solidity
modifier onlyNotPaused()
```

_Modifier that checks that the protocol is not paused._

### onlyAdmin

```solidity
modifier onlyAdmin()
```

_Modifier that checks that the caller is the pool's admin._

### atState

```solidity
modifier atState(enum IPoolLifeCycleState state_)
```

_Modifier that checks that the pool is Initialized or Active_

### atInitializedOrActiveState

```solidity
modifier atInitializedOrActiveState()
```

_Modifier that checks that the pool is Initialized or Active_

### atActiveOrClosedState

```solidity
modifier atActiveOrClosedState()
```

_Modifier that checks that the pool is Initialized or Active_

### isPoolLoan

```solidity
modifier isPoolLoan(address loan)
```

_Modifier to check that an addres is a Perimeter loan associated
with this pool._

### onlyCrankedPool

```solidity
modifier onlyCrankedPool()
```

_Modifier to ensure that the Pool is cranked._

### initialize

```solidity
function initialize(address pool_, address serviceConfiguration_, address admin_, address liquidityAsset_, struct IPoolConfigurableSettings poolSettings_) public
```

### settings

```solidity
function settings() external view returns (struct IPoolConfigurableSettings)
```

_The current configurable pool settings._

### setRequestFee

```solidity
function setRequestFee(uint256 feeBps) external
```

_Allow the current pool admin to update the pool fees
before the pool has been activated._

### requestFee

```solidity
function requestFee(uint256 sharesOrAssets) public view returns (uint256 feeShares)
```

_Returns the redeem fee for a given withdrawal amount at the current block.
The fee is the number of shares that will be charged._

### setRequestCancellationFee

```solidity
function setRequestCancellationFee(uint256 feeBps) external
```

_Allow the current pool admin to update the pool cancellation fees
before the pool has been activated._

### requestCancellationFee

```solidity
function requestCancellationFee(uint256 sharesOrAssets) public view returns (uint256 feeShares)
```

_Returns the cancellation fee for a given withdrawal request at the
current block. The fee is the number of shares that will be charged._

### setWithdrawGate

```solidity
function setWithdrawGate(uint256 _withdrawGateBps) external
```

_Allow the current pool admin to update the withdraw gate at any
time if the pool is Initialized or Active_

### withdrawGate

```solidity
function withdrawGate() public view returns (uint256)
```

_Returns the current withdraw gate in bps. If the pool is closed,
this is set to 10_000 (100%)_

### withdrawRequestPeriodDuration

```solidity
function withdrawRequestPeriodDuration() public view returns (uint256)
```

_Returns the current withdraw request period duration in seconds. If the pool is closed,
this is lowered (if needed) to 1 day._

### setPoolCapacity

```solidity
function setPoolCapacity(uint256 newCapacity) external
```

@dev

### setPoolEndDate

```solidity
function setPoolEndDate(uint256 endDate) external
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

### setServiceFeeBps

```solidity
function setServiceFeeBps(uint256 serviceFeeBps) external
```

_Allow the current pool admin to update the service fee._

### setFixedFee

```solidity
function setFixedFee(uint256 amount, uint256 interval) external
```

_Allow the current pool admin to update the fixed fee._

### state

```solidity
function state() public view returns (enum IPoolLifeCycleState)
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

### _setState

```solidity
function _setState(enum IPoolLifeCycleState newState) internal
```

_Set the pool lifecycle state. If the state changes, this method
will also update the activatedAt variable_

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
function fundLoan(address addr) external
```

_Called by the pool admin, this transfers liquidity from the pool to a given loan._

### defaultLoan

```solidity
function defaultLoan(address loan) external
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

## WithdrawController

### _pool

```solidity
contract IPool _pool
```

_A reference to the pool for this withdraw state_

### _withdrawState

```solidity
mapping(address => struct IPoolWithdrawState) _withdrawState
```

_Per-lender withdraw request information_

### _globalWithdrawState

```solidity
struct IPoolWithdrawState _globalWithdrawState
```

_Aggregate withdraw request information_

### _snapshots

```solidity
mapping(uint256 => struct IPoolSnapshotState) _snapshots
```

_Mapping of withdrawPeriod to snapshot_

### onlyPool

```solidity
modifier onlyPool()
```

_Modifier that checks that the caller is a pool lender_

### initialize

```solidity
function initialize(address pool) public
```

_Initializer for a Pool's withdraw state_

### withdrawPeriod

```solidity
function withdrawPeriod() public view returns (uint256 period)
```

_The current withdraw period. Funds marked with this period (or
earlier), are eligible to be considered for redemption/widrawal.

TODO: This can be internal_

### _currentWithdrawState

```solidity
function _currentWithdrawState(address owner) internal view returns (struct IPoolWithdrawState state)
```

_Returns the current withdraw state of an owner._

### _currentGlobalWithdrawState

```solidity
function _currentGlobalWithdrawState() internal view returns (struct IPoolWithdrawState state)
```

_Returns the current global withdraw state._

### interestBearingBalanceOf

```solidity
function interestBearingBalanceOf(address owner) external view returns (uint256 shares)
```

_Returns the amount of shares that should be considered interest
bearing for a given owner.  This number is their balance, minus their
"redeemable" shares._

### requestedBalanceOf

```solidity
function requestedBalanceOf(address owner) external view returns (uint256 shares)
```

_Returns the number of shares that have been requested to be redeemed
by the owner as of the current block._

### totalRequestedBalance

```solidity
function totalRequestedBalance() external view returns (uint256 shares)
```

_Returns the number of shares that are available to be redeemed by
the owner in the current block._

### eligibleBalanceOf

```solidity
function eligibleBalanceOf(address owner) external view returns (uint256 shares)
```

_Returns the number of shares owned by an address that are "vested"
enough to be considered for redeeming during the next withdraw period._

### totalEligibleBalance

```solidity
function totalEligibleBalance() external view returns (uint256 shares)
```

_Returns the number of shares overall that are "vested" enough to be
considered for redeeming during the next withdraw period._

### totalRedeemableShares

```solidity
function totalRedeemableShares() external view returns (uint256 shares)
```

_Returns the number of shares that are available to be redeemed
overall in the current block._

### totalWithdrawableAssets

```solidity
function totalWithdrawableAssets() external view returns (uint256 assets)
```

_Returns the number of `assets` that are available to be withdrawn
overall in the current block._

### maxRedeemRequest

```solidity
function maxRedeemRequest(address owner) external view returns (uint256 maxShares)
```

_Returns the maximum number of `shares` that can be
requested to be redeemed from the owner balance with a single
`requestRedeem` call in the current block.

Note: This is equivalent of EIP-4626 `maxRedeem`_

### maxRedeem

```solidity
function maxRedeem(address owner) public view returns (uint256 maxShares)
```

_The maximum amount of shares that can be redeemed from the owner
balance through a redeem call._

### maxWithdraw

```solidity
function maxWithdraw(address owner) external view returns (uint256 assets)
```

_Returns the maximum amount of underlying assets that can be
withdrawn from the owner balance with a single withdraw call._

### previewRedeemRequest

```solidity
function previewRedeemRequest(uint256 shares) external view returns (uint256 assets)
```

_Simulate the effects of a redeem request at the current block.
Returns the amount of underlying assets that would be requested if this
entire redeem request were to be processed at the current block.

Note: This is equivalent of EIP-4626 `previewRedeem`_

### previewWithdrawRequest

```solidity
function previewWithdrawRequest(uint256 assets) external view returns (uint256 shares)
```

_Simulate the effects of a withdrawal request at the current block.
Returns the amount of `shares` that would be burned if this entire
withdrawal request were to be processed at the current block.

Note: This is equivalent of EIP-4626 `previewWithdraw`_

### previewRedeem

```solidity
function previewRedeem(address owner, uint256 shares) external view returns (uint256 assets)
```

_Simulates the effects of their redeemption at the current block.
Per EIP4626, should round DOWN._

### previewWithdraw

```solidity
function previewWithdraw(address owner, uint256 assets) external view returns (uint256 shares)
```

_Simulate the effects of their withdrawal at the current block.
Per EIP4626, should round UP on the number of shares required for assets._

### performRequest

```solidity
function performRequest(address owner, uint256 shares) external
```

_Requests redeeming a specific number of `shares` and `assets` from
the pool.

NOTE: The pool is responsible for handling any fees, and for providing
the proper shares/assets ratio._

### maxRequestCancellation

```solidity
function maxRequestCancellation(address owner) public view returns (uint256 maxShares)
```

_Returns the maximum number of `shares` that can be
cancelled from being requested for a redemption.

Note: This is equivalent of EIP-4626 `maxRedeem`_

### performRequestCancellation

```solidity
function performRequestCancellation(address owner, uint256 shares) external
```

_Cancels a withdraw request for the owner,

NOTE This method does not charge fees, as this should be handled outside
of the WithdrawController._

### crank

```solidity
function crank(uint256 withdrawGate) external returns (uint256 period, uint256 redeemableShares, uint256 withdrawableAssets, bool periodCranked)
```

_Crank the protocol. Performs accounting for withdrawals_

### simulateCrank

```solidity
function simulateCrank(struct IPoolWithdrawState withdrawState) internal view returns (struct IPoolWithdrawState)
```

_Simulates the effects of multiple snapshots against a lenders
requested withdrawal._

### crankLender

```solidity
function crankLender(address addr) internal returns (struct IPoolWithdrawState state)
```

_Cranks a lender_

### redeem

```solidity
function redeem(address owner, uint256 shares) external returns (uint256 assets)
```

_Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.

Per EIP4626, should round DOWN._

### withdraw

```solidity
function withdraw(address owner, uint256 assets) external returns (uint256 shares)
```

_Burns shares from owner and send exactly assets token from the vault to receiver.
Should round UP for EIP4626._

### _performWithdraw

```solidity
function _performWithdraw(address owner, struct IPoolWithdrawState currentState, uint256 shares, uint256 assets) internal
```

_Perform the state update for a withdraw_

## PoolControllerFactory

### constructor

```solidity
constructor(address serviceConfiguration) public
```

### createController

```solidity
function createController(address pool, address serviceConfiguration, address admin, address liquidityAsset, struct IPoolConfigurableSettings poolSettings) public virtual returns (address addr)
```

_Creates a pool's PoolAdmin controller
Emits `PoolControllerCreated` event._

## WithdrawControllerFactory

### constructor

```solidity
constructor(address serviceConfiguration) public
```

### createController

```solidity
function createController(address pool) public virtual returns (address addr)
```

_Creates a pool's withdraw controller
Emits `WithdrawControllerCreated` event._

## IServiceConfigurable

_Interface indicating that the contract is controlled by the protocol service configuration._

### serviceConfiguration

```solidity
function serviceConfiguration() external view returns (address)
```

_Address of the protocol service configuration._

## MockERC20

### _decimals

```solidity
uint8 _decimals
```

### constructor

```solidity
constructor(string name, string symbol, uint8 decimals_) public
```

### decimals

```solidity
function decimals() public view returns (uint8)
```

_Returns the number of decimals used to get its user representation.
For example, if `decimals` equals `2`, a balance of `505` tokens should
be displayed to a user as `5.05` (`505 / 10 ** 2`).

Tokens usually opt for a value of 18, imitating the relationship between
Ether and Wei. This is the value {ERC20} uses, unless this function is
overridden;

NOTE: This information is only used for _display_ purposes: it in
no way affects any of the arithmetic of the contract, including
{IERC20-balanceOf} and {IERC20-transfer}._

## MockERC721

### constructor

```solidity
constructor(string name, string symbol, string baseTokenURI) public
```

## MockILoan

_Mock implementation of a Loan_

### paymentsRemaining

```solidity
uint256 paymentsRemaining
```

### payment

```solidity
uint256 payment
```

### paymentDueDate

```solidity
uint256 paymentDueDate
```

### paymentPeriod

```solidity
uint256 paymentPeriod
```

### principal

```solidity
uint256 principal
```

### state

```solidity
enum ILoanLifeCycleState state
```

### setPrincipal

```solidity
function setPrincipal(uint256 principal_) external
```

### setPayment

```solidity
function setPayment(uint256 payment_) external
```

### setPaymentPeriod

```solidity
function setPaymentPeriod(uint256 paymentPeriod_) external
```

### setPaymentDueDate

```solidity
function setPaymentDueDate(uint256 paymentDueDate_) external
```

### setPaymentsRemaining

```solidity
function setPaymentsRemaining(uint256 paymentsRemaining_) external
```

### setState

```solidity
function setState(enum ILoanLifeCycleState state_) external
```

## PoolLibTestWrapper

_Wrapper around PoolLib to facilitate testing._

### _activeLoans

```solidity
struct EnumerableSet.AddressSet _activeLoans
```

### _accountings

```solidity
struct IPoolAccountings _accountings
```

### LifeCycleStateTransition

```solidity
event LifeCycleStateTransition(enum IPoolLifeCycleState state)
```

### FirstLossDeposited

```solidity
event FirstLossDeposited(address caller, address supplier, uint256 amount)
```

### FirstLossWithdrawn

```solidity
event FirstLossWithdrawn(address caller, address receiver, uint256 amount)
```

### Deposit

```solidity
event Deposit(address caller, address owner, uint256 assets, uint256 shares)
```

### executeFirstLossDeposit

```solidity
function executeFirstLossDeposit(address liquidityAsset, address spender, uint256 amount, address firstLossVault, enum IPoolLifeCycleState currentState, uint256 minFirstLossRequired) external
```

### executeFirstLossWithdraw

```solidity
function executeFirstLossWithdraw(uint256 amount, address withdrawReceiver, address firstLossVault) external returns (uint256)
```

### calculateConversion

```solidity
function calculateConversion(uint256 input, uint256 numerator, uint256 denominator, bool roundUp) public pure returns (uint256)
```

### calculateSharesFromAssets

```solidity
function calculateSharesFromAssets(uint256 assets, uint256 totalShares, uint256 totalAssets, bool roundUp) external pure returns (uint256)
```

### calculateAssetsFromShares

```solidity
function calculateAssetsFromShares(uint256 shares, uint256 totalAssets, uint256 totalShares, bool roundUp) external pure returns (uint256)
```

### calculateTotalAssets

```solidity
function calculateTotalAssets(address asset, address vault, uint256 outstandingLoanPrincipals) external view returns (uint256)
```

### calculateTotalAvailableAssets

```solidity
function calculateTotalAvailableAssets(address asset, address vault, uint256 outstandingLoanPrincipals, uint256 withdrawableAssets) external view returns (uint256)
```

### calculateTotalAvailableShares

```solidity
function calculateTotalAvailableShares(address vault, uint256 redeemableShares) external view returns (uint256)
```

### calculateMaxDeposit

```solidity
function calculateMaxDeposit(enum IPoolLifeCycleState poolLifeCycleState, uint256 poolMaxCapacity, uint256 totalAvailableAssets) external pure returns (uint256)
```

### setMockActiveLoans

```solidity
function setMockActiveLoans(address[] loans) public
```

### calculateExpectedInterestFromMocks

```solidity
function calculateExpectedInterestFromMocks() public view returns (uint256 expectedInterest)
```

### executeDeposit

```solidity
function executeDeposit(address asset, address vault, address sharesReceiver, uint256 assets, uint256 shares, uint256 maxDeposit) external returns (uint256)
```

### isPoolLoan

```solidity
function isPoolLoan(address loan, address serviceConfiguration, address pool) public view returns (bool)
```

### calculateCurrentWithdrawPeriod

```solidity
function calculateCurrentWithdrawPeriod(uint256 currentTimestamp, uint256 activatedAt, uint256 withdrawalWindowDuration) public pure returns (uint256)
```

### calculateWithdrawStateForRequest

```solidity
function calculateWithdrawStateForRequest(struct IPoolWithdrawState state, uint256 currentPeriod, uint256 requestedShares) public pure returns (struct IPoolWithdrawState)
```

### calculateWithdrawStateForCancellation

```solidity
function calculateWithdrawStateForCancellation(struct IPoolWithdrawState state, uint256 currentPeriod, uint256 cancelledShares) public pure returns (struct IPoolWithdrawState)
```

### calculateRequestFee

```solidity
function calculateRequestFee(uint256 shares, uint256 requestFeeBps) external pure returns (uint256)
```

### calculateCancellationFee

```solidity
function calculateCancellationFee(uint256 shares, uint256 requestCancellationFeeBps) external pure returns (uint256)
```

### calculateMaxRedeemRequest

```solidity
function calculateMaxRedeemRequest(struct IPoolWithdrawState state, uint256 shareBalance, uint256 requestFeeBps) public pure returns (uint256)
```

### calculateMaxCancellation

```solidity
function calculateMaxCancellation(struct IPoolWithdrawState state, uint256 requestCancellationFeeBps) public pure returns (uint256)
```

## LoanMockV2

_Simulated new Loan implementation_

## MockBeaconImplementation

### foo

```solidity
function foo() external pure virtual returns (string)
```

### initialize

```solidity
function initialize() public
```

## MockBeaconImplementationV2

### foo

```solidity
function foo() external pure returns (string)
```

## MockBeaconProxyFactory

### Created

```solidity
event Created(address proxy)
```

### constructor

```solidity
constructor(address serviceConfig) public
```

### create

```solidity
function create() external returns (address)
```

## DeployerUUPSUpgradeableMock

### foo

```solidity
function foo() external pure virtual returns (string)
```

### initialize

```solidity
function initialize(address serviceConfiguration) public
```

## DeployerUUPSUpgradeableMockV2

### foo

```solidity
function foo() external pure returns (string)
```

## PoolControllerMockV2

_Simulated new ServiceConfiguration implementation_

## PoolMockV2

_Simulated new Pool implementation_

## ServiceConfigurationMockV2

_Simulated new ServiceConfiguration implementation_

## ToSAcceptanceRegistryMockV2

_Simulated new ToSAcceptanceRegistry implementation_

## WithdrawControllerMockV2

_Simulated new ServiceConfiguration implementation_

## PermissionedServiceConfiguration

### poolAdminAccessControl

```solidity
contract IPoolAdminAccessControl poolAdminAccessControl
```

_Access Control logic for the Pool Admin role_

### setPoolAdminAccessControl

```solidity
function setPoolAdminAccessControl(contract IPoolAdminAccessControl _poolAdminAccessControl) public
```

_Set the PoolAdminAccessControl contract.
Emits `AddressSet` event._

## ToSAcceptanceRegistry

### hasAccepted

```solidity
mapping(address => bool) hasAccepted
```

_Returns whether an address has accepted the TermsOfService._

### _termsOfService

```solidity
string _termsOfService
```

_ToS URL._

### _termsSet

```solidity
bool _termsSet
```

_Flag to track when the ToS are "initialized"_

### onlyOperator

```solidity
modifier onlyOperator()
```

_Restricts caller to ServiceOperator_

### initialize

```solidity
function initialize(address serviceConfiguration) public
```

_Initializer for the ToSAcceptanceRegistry_

### acceptTermsOfService

```solidity
function acceptTermsOfService() external
```

_Records that msg.sender has accepted the TermsOfService._

### updateTermsOfService

```solidity
function updateTermsOfService(string url) external
```

_Updates the TermsOfService._

### termsOfService

```solidity
function termsOfService() external view returns (string)
```

_Returns the current TermsOfService URL_

