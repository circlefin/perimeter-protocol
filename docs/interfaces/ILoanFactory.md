# Solidity API

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

