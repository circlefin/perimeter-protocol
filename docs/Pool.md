# Solidity API

## Pool

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
function initialize(address liquidityAsset, address poolAdmin, address serviceConfiguration, address withdrawControllerFactory, address poolControllerFactory, struct IPoolConfigurableSettings poolSettings, string tokenName, string tokenSymbol) public
```

_Initializer for Pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityAsset | address | asset held by the poo |
| poolAdmin | address | admin of the pool |
| serviceConfiguration | address | address of global service configuration |
| withdrawControllerFactory | address | factory address of the withdraw controller |
| poolControllerFactory | address |  |
| poolSettings | struct IPoolConfigurableSettings | configurable settings for the pool |
| tokenName | string | Name used for issued pool tokens |
| tokenSymbol | string | Symbol used for issued pool tokens |

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
function convertToShares(uint256 assets) public view returns (uint256)
```

_Calculates the amount of shares that would be exchanged by the vault for the amount of assets provided.
Rounds DOWN per EIP4626._

### convertToAssets

```solidity
function convertToAssets(uint256 shares) public view returns (uint256)
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
function previewDeposit(uint256 assets) public view returns (uint256)
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

