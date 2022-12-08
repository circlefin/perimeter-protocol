# Solidity API

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

