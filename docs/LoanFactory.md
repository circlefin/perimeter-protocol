# Solidity API

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

