# Solidity API

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

