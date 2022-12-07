# Solidity API

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

