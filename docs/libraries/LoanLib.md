# Solidity API

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

