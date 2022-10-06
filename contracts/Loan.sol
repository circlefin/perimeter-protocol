// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./libraries/LoanLib.sol";
import "./CollateralVault.sol";
import "./FundingVault.sol";

/**
 * @title Loan
 *
 * Empty Loan contract.
 */
contract Loan is ILoan {
    IServiceConfiguration private immutable _serviceConfiguration;
    address private immutable _factory;
    ILoanLifeCycleState private _state = ILoanLifeCycleState.Requested;
    address private immutable _borrower;
    address private immutable _pool;
    CollateralVault public immutable _collateralVault;
    FundingVault public immutable fundingVault;
    address[] private _fungibleCollateral;
    ILoanNonFungibleCollateral[] private _nonFungibleCollateral;
    uint256 private immutable _dropDeadTimestamp;
    uint256 public immutable createdAt;
    uint256 public immutable duration;
    uint256 public immutable paymentPeriod;
    uint256 public immutable apr;
    uint256 public immutable principal;
    address public immutable liquidityAsset;
    ILoanType public immutable loanType = ILoanType.Fixed;

    /**
     * @dev Modifier that requires the Loan be in the given `state_`
     */
    modifier atState(ILoanLifeCycleState state) {
        require(
            _state == state,
            "Loan: FunctionInvalidAtThisILoanLifeCycleState"
        );
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` to be the pool. Loan assumes the pool has performed access checks
     */
    modifier onlyPool() {
        require(msg.sender == _pool, "Loan: caller is not pool");
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` be the borrower.
     */
    modifier onlyBorrower() {
        require(msg.sender == _borrower, "Loan: caller is not borrower");
        _;
    }

    /**
     * @dev Modifier that requires the loan not be in a terminal state.
     */
    modifier onlyActiveLoan() {
        require(
            _state != ILoanLifeCycleState.Canceled,
            "Loan: loan is in terminal state"
        );
        require(
            _state != ILoanLifeCycleState.Defaulted,
            "Loan: loan is in terminal state"
        );
        require(
            _state != ILoanLifeCycleState.Matured,
            "Loan: loan is in terminal state"
        );
        _;
    }

    constructor(
        IServiceConfiguration serviceConfiguration,
        address factory,
        address borrower,
        address pool,
        uint256 duration_,
        uint256 paymentPeriod_,
        ILoanType loanType_,
        uint256 apr_,
        address liquidityAsset_,
        uint256 principal_,
        uint256 dropDeadTimestamp
    ) {
        _serviceConfiguration = serviceConfiguration;
        _factory = factory;
        _borrower = borrower;
        _pool = pool;
        _collateralVault = new CollateralVault(address(this));
        fundingVault = new FundingVault(address(this), liquidityAsset_);
        _dropDeadTimestamp = dropDeadTimestamp;
        createdAt = block.timestamp;
        duration = duration_;
        paymentPeriod = paymentPeriod_;
        apr = apr_;
        liquidityAsset = liquidityAsset_;
        principal = principal_;

        LoanLib.validateLoan(
            serviceConfiguration,
            duration,
            paymentPeriod,
            loanType,
            principal,
            liquidityAsset
        );
    }

    /**
     * @dev Cancel the Loan
     */
    function cancelRequested()
        external
        onlyBorrower
        atState(ILoanLifeCycleState.Requested)
        returns (ILoanLifeCycleState)
    {
        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @dev Cancel the Loan and return any collateral
     */
    function cancelCollateralized()
        external
        onlyBorrower
        atState(ILoanLifeCycleState.Collateralized)
        returns (ILoanLifeCycleState)
    {
        require(
            _dropDeadTimestamp < block.timestamp,
            "Loan: Drop dead date not met"
        );
        LoanLib.withdrawFungibleCollateral(
            _collateralVault,
            _fungibleCollateral
        );
        LoanLib.withdrawNonFungibleCollateral(
            _collateralVault,
            _nonFungibleCollateral
        );

        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral(address asset, uint256 amount)
        external
        onlyBorrower
        onlyActiveLoan
        returns (ILoanLifeCycleState)
    {
        _state = LoanLib.postFungibleCollateral(
            address(_collateralVault),
            asset,
            amount,
            _state,
            _fungibleCollateral
        );
        return _state;
    }

    function fungibleCollateral() external view returns (address[] memory) {
        return _fungibleCollateral;
    }

    /**
     * @dev Post ERC721 tokens as collateral
     */
    function postNonFungibleCollateral(address asset, uint256 tokenId)
        external
        onlyBorrower
        onlyActiveLoan
        returns (ILoanLifeCycleState)
    {
        _state = LoanLib.postNonFungibleCollateral(
            address(_collateralVault),
            asset,
            tokenId,
            _state,
            _nonFungibleCollateral
        );
        return _state;
    }

    function nonFungibleCollateral()
        external
        view
        returns (ILoanNonFungibleCollateral[] memory)
    {
        return _nonFungibleCollateral;
    }

    /**
     * @dev Fund the Loan
     * @dev Can only be called by the pool
     */
    function fund()
        external
        onlyPool
        atState(ILoanLifeCycleState.Collateralized)
        returns (ILoanLifeCycleState)
    {
        _state = LoanLib.fundLoan(liquidityAsset, fundingVault, principal);
        return _state;
    }

    /**
     * @dev Drawdown the Loan
     */
    function drawdown()
        external
        onlyBorrower
        atState(ILoanLifeCycleState.Funded)
        returns (uint256)
    {
        // Fixed term loans require the borrower to drawdown the full amount
        uint256 amount = IERC20(liquidityAsset).balanceOf(
            address(fundingVault)
        );
        LoanLib.drawdown(fundingVault, amount, msg.sender);
        return amount;
    }

    /**
     * @inheritdoc ILoan
     */
    function markDefaulted()
        external
        override
        onlyPool
        atState(ILoanLifeCycleState.Funded)
        returns (ILoanLifeCycleState)
    {
        _state = ILoanLifeCycleState.Defaulted;
        emit LifeCycleStateTransition(_state);
        return _state;
    }

    function state() external view returns (ILoanLifeCycleState) {
        return _state;
    }

    function borrower() external view returns (address) {
        return _borrower;
    }

    function pool() external view returns (address) {
        return _pool;
    }

    function factory() external view returns (address) {
        return _factory;
    }

    function dropDeadTimestamp() external view returns (uint256) {
        return _dropDeadTimestamp;
    }
}
