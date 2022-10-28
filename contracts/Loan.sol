// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
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
    using SafeMath for uint256;
    uint256 constant RAY = 10**27;

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
    uint256 public immutable payment;
    uint256 public paymentsRemaining;
    uint256 public paymentDueDate;
    uint256 public originationFee;
    ILoanFees fees;

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
    modifier onlyNonTerminalState() {
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
        uint256 dropDeadTimestamp,
        ILoanFees memory fees_
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
        fees = fees_;

        LoanLib.validateLoan(
            serviceConfiguration,
            duration,
            paymentPeriod,
            loanType,
            principal,
            liquidityAsset
        );

        paymentsRemaining = duration.div(paymentPeriod);
        uint256 paymentsTotal = principal
            .mul(apr)
            .mul(duration.mul(RAY).div(360))
            .div(RAY)
            .div(10000);
        payment = paymentsTotal.mul(RAY).div(paymentsRemaining).div(RAY);

        // Persist origination fee per payment period
        originationFee = principal
            .mul(fees.originationBps)
            .mul(duration.mul(RAY).div(360))
            .div(paymentsRemaining)
            .div(RAY)
            .div(10000);
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

        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function cancelFunded()
        external
        override
        atState(ILoanLifeCycleState.Funded)
        returns (ILoanLifeCycleState)
    {
        require(
            msg.sender == _borrower || msg.sender == IPool(_pool).manager(),
            "Loan: invalid caller"
        );
        require(
            _dropDeadTimestamp < block.timestamp,
            "Loan: Drop dead date not met"
        );

        LoanLib.returnCanceledLoanPrincipal(fundingVault, _pool, principal);
        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @dev Claims specific collateral types. Can be called by the borrower (when Canceled or Matured)
     * or by the PA (when Defaulted)
     */
    function claimCollateral(
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external override {
        require(
            (_state == ILoanLifeCycleState.Canceled &&
                msg.sender == _borrower) ||
                (_state == ILoanLifeCycleState.Defaulted &&
                    msg.sender == IPool(_pool).manager()) ||
                (_state == ILoanLifeCycleState.Matured &&
                    msg.sender == _borrower),
            "Loan: unable to claim collateral"
        );

        LoanLib.withdrawFungibleCollateral(_collateralVault, assets);
        LoanLib.withdrawNonFungibleCollateral(
            _collateralVault,
            nonFungibleAssets
        );
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral(address asset, uint256 amount)
        external
        onlyBorrower
        onlyNonTerminalState
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
        onlyNonTerminalState
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
        // First drawdown kicks off the payment schedule
        if (paymentDueDate == 0) {
            paymentDueDate = block.timestamp + (paymentPeriod * 1 days);
        }

        // Fixed term loans require the borrower to drawdown the full amount
        uint256 amount = IERC20(liquidityAsset).balanceOf(
            address(fundingVault)
        );
        LoanLib.drawdown(fundingVault, amount, msg.sender);
        _state = ILoanLifeCycleState.Active;
        return amount;
    }

    function completeNextPayment()
        public
        onlyBorrower
        atState(ILoanLifeCycleState.Active)
        returns (uint256)
    {
        require(paymentsRemaining > 0, "Loan: No more payments remain");

        (uint256 poolPayment, uint256 firstLossFee, uint256 poolFee) = LoanLib
            .previewFees(
                payment,
                _serviceConfiguration.firstLossFeeBps(),
                IPool(_pool).poolFeePercentOfInterest(),
                fees.latePayment,
                paymentDueDate
            );

        LoanLib.payFees(
            liquidityAsset,
            IPool(_pool).firstLossVault(),
            firstLossFee,
            IPool(_pool).feeVault(),
            poolFee,
            originationFee
        );
        LoanLib.completePayment(liquidityAsset, _pool, poolPayment);
        paymentsRemaining -= 1;
        paymentDueDate += paymentPeriod * 1 days;
        return payment;
    }

    function completeFullPayment()
        public
        onlyBorrower
        atState(ILoanLifeCycleState.Active)
        returns (uint256)
    {
        uint256 amount = payment.mul(paymentsRemaining);

        (uint256 poolPayment, uint256 firstLossFee, uint256 poolFee) = LoanLib
            .previewFees(
                amount,
                _serviceConfiguration.firstLossFeeBps(),
                IPool(_pool).poolFeePercentOfInterest(),
                fees.latePayment,
                paymentDueDate
            );

        LoanLib.payFees(
            liquidityAsset,
            IPool(_pool).firstLossVault(),
            firstLossFee,
            IPool(_pool).manager(),
            poolFee,
            originationFee
        );

        LoanLib.completePayment(
            liquidityAsset,
            _pool,
            poolPayment.add(principal)
        );
        paymentsRemaining = 0;
        _state = ILoanLifeCycleState.Matured;
        IPool(_pool).notifyLoanPrincipalReturned();
        return amount;
    }

    /**
     * @inheritdoc ILoan
     */
    function markDefaulted()
        external
        override
        onlyPool
        atState(ILoanLifeCycleState.Active)
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
