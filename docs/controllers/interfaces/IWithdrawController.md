# Solidity API

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

