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

    IServiceConfiguration private _serviceConfiguration;
    address private immutable _factory;
    ILoanLifeCycleState private _state = ILoanLifeCycleState.Requested;
    address private immutable _borrower;
    address private immutable _pool;
    CollateralVault public immutable _collateralVault;
    FundingVault public immutable fundingVault;
    address[] private _fungibleCollateral;
    ILoanNonFungibleCollateral[] private _nonFungibleCollateral;
    uint256 public immutable createdAt;
    address public immutable liquidityAsset;
    uint256 public immutable payment;
    uint256 public outstandingPrincipal;
    uint256 public paymentsRemaining;
    uint256 public paymentDueDate;
    uint256 public callbackTimestamp;
    ILoanSettings settings;

    event FundsReclaimed(uint256 amount, address pool);

    /**
     * @dev Modifier that requires the Loan be in the given `state_`
     */
    modifier atState(ILoanLifeCycleState state_) {
        require(
            _state == state_,
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
     * @dev Modifier that requires `msg.sender` to be the pool controller.
     */
    modifier onlyPoolController() {
        require(
            msg.sender == address(IPool(_pool).poolController()),
            "Loan: caller is not pool"
        );
        _;
    }

    /**
     * @dev Modifier that requires `msg.sender` be the borrower.
     */
    modifier onlyBorrower() {
        require(msg.sender == _borrower, "Loan: caller is not borrower");
        _;
    }

    modifier onlyPoolAdmin() {
        require(
            msg.sender == IPool(_pool).admin(),
            "Loan: caller is not pool admin"
        );
        _;
    }

    /**
     * @dev Modifier that can be overriden by derived classes to enforce
     * access control.
     */
    modifier onlyPermittedBorrower() virtual {
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
        address factory_,
        address borrower_,
        address pool_,
        address liquidityAsset_,
        ILoanSettings memory settings_
    ) {
        _serviceConfiguration = serviceConfiguration;
        _factory = factory_;
        _borrower = borrower_;
        _pool = pool_;
        _collateralVault = new CollateralVault(address(this));
        fundingVault = new FundingVault(address(this), liquidityAsset_);
        createdAt = block.timestamp;
        liquidityAsset = liquidityAsset_;
        settings = settings_;

        LoanLib.validateLoan(
            serviceConfiguration,
            settings.duration,
            settings.paymentPeriod,
            settings.principal,
            liquidityAsset
        );

        paymentsRemaining = settings.duration.div(settings.paymentPeriod);
        uint256 paymentsTotal = settings
            .principal
            .mul(settings.apr)
            .mul(settings.duration.mul(RAY).div(360))
            .div(RAY)
            .div(10000);
        payment = paymentsTotal.mul(RAY).div(paymentsRemaining).div(RAY);
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
        requireNotPaused();
        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @dev Cancel the Loan and return any collateral
     */
    function cancelCollateralized()
        external
        onlyPermittedBorrower
        onlyBorrower
        atState(ILoanLifeCycleState.Collateralized)
        returns (ILoanLifeCycleState)
    {
        requireNotPaused();
        require(
            settings.dropDeadTimestamp < block.timestamp,
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
        requireNotPaused();
        require(
            msg.sender == _borrower || msg.sender == IPool(_pool).admin(),
            "Loan: invalid caller"
        );
        require(
            settings.dropDeadTimestamp < block.timestamp,
            "Loan: Drop dead date not met"
        );

        LoanLib.returnCanceledLoanPrincipal(
            fundingVault,
            _pool,
            settings.principal
        );
        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @dev Claims specific collateral types. Can be called by the borrower
     * (when Canceled or Matured) or by the PA (when Defaulted)
     */
    function claimCollateral(
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external override {
        requireNotPaused();
        require(
            (_state == ILoanLifeCycleState.Canceled &&
                msg.sender == _borrower) ||
                (_state == ILoanLifeCycleState.Defaulted &&
                    msg.sender == IPool(_pool).admin()) ||
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
        virtual
        onlyPermittedBorrower
        onlyBorrower
        onlyNonTerminalState
        returns (ILoanLifeCycleState)
    {
        requireNotPaused();
        require(amount > 0, "Loan: posting 0 collateral");
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
        virtual
        onlyPermittedBorrower
        onlyBorrower
        onlyNonTerminalState
        returns (ILoanLifeCycleState)
    {
        requireNotPaused();
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
    function fund() external onlyPool returns (ILoanLifeCycleState) {
        requireNotPaused();
        require(
            _state == ILoanLifeCycleState.Requested ||
                _state == ILoanLifeCycleState.Collateralized,
            "Loan: FunctionInvalidAtThisILoanLifeCycleState"
        );
        _state = LoanLib.fundLoan(
            liquidityAsset,
            fundingVault,
            settings.principal
        );
        return _state;
    }

    /**
     * @dev Pool administrators can reclaim funds in open term loans.
     */
    function reclaimFunds(uint256 amount) external onlyPoolAdmin {
        requireNotPaused();
        require(settings.loanType == ILoanType.Open);

        fundingVault.withdraw(amount, _pool);
        IPool(_pool).onLoanPrincipalReturned(amount);

        emit FundsReclaimed(amount, _pool);
    }

    /**
     * @dev Drawdown the Loan
     */
    function drawdown(uint256 amount)
        external
        virtual
        onlyPermittedBorrower
        onlyBorrower
        returns (uint256)
    {
        requireNotPaused();
        (_state, paymentDueDate) = LoanLib.drawdown(
            amount,
            fundingVault,
            msg.sender,
            paymentDueDate,
            settings,
            _state
        );
        outstandingPrincipal += amount;
        IPool(_pool).onLoanStateTransitioned();
        return amount;
    }

    /**
     * @dev Prepay principal.
     * @dev Only callable by open term loans
     */
    function paydownPrincipal(uint256 amount)
        external
        onlyPermittedBorrower
        onlyBorrower
    {
        requireNotPaused();
        require(outstandingPrincipal >= amount, "Loan: amount too high");
        require(settings.loanType == ILoanType.Open, "Loan: invalid loan type");
        LoanLib.paydownPrincipal(liquidityAsset, amount, fundingVault);
        outstandingPrincipal -= amount;
    }

    /**
     * @dev Complete the next payment according to loan schedule inclusive of all fees.
     */
    function completeNextPayment()
        external
        onlyPermittedBorrower
        onlyBorrower
        atState(ILoanLifeCycleState.Active)
        returns (uint256)
    {
        requireNotPaused();
        require(paymentsRemaining > 0, "Loan: No more payments remain");

        ILoanFees memory _fees = LoanLib.previewFees(
            settings,
            payment,
            _serviceConfiguration.firstLossFeeBps(),
            IPool(_pool).poolFeePercentOfInterest(),
            block.timestamp,
            paymentDueDate,
            RAY
        );

        LoanLib.payFees(
            liquidityAsset,
            IPool(_pool).firstLossVault(),
            IPool(_pool).feeVault(),
            _fees
        );

        LoanLib.completePayment(
            liquidityAsset,
            _pool,
            _fees.interestPayment + _fees.latePaymentFee
        );
        paymentsRemaining -= 1;
        paymentDueDate += settings.paymentPeriod * 1 days;
        return payment;
    }

    /**
     * @dev Preview fees for a given interest payment amount.
     * @param amount allows previewing the fee for a full or prorated payment.
     */
    function previewFees(uint256 amount)
        public
        view
        returns (ILoanFees memory)
    {
        return
            LoanLib.previewFees(
                settings,
                amount,
                _serviceConfiguration.firstLossFeeBps(),
                IPool(_pool).poolFeePercentOfInterest(),
                block.timestamp,
                paymentDueDate,
                RAY
            );
    }

    /**
     * @dev Complete the final payment of the loan.
     */
    function completeFullPayment()
        external
        onlyPermittedBorrower
        onlyBorrower
        atState(ILoanLifeCycleState.Active)
        returns (uint256)
    {
        requireNotPaused();
        uint256 scalingValue = RAY;

        if (settings.loanType == ILoanType.Open) {
            // If an open term loan payment is not overdue, we will prorate the
            // payment
            if (paymentDueDate > block.timestamp) {
                // Calculate the scaling value
                // RAY - ((paymentDueDate - blocktimestamp) * RAY / paymentPeriod (seconds))
                scalingValue = RAY.sub(
                    (paymentDueDate - block.timestamp).mul(RAY).div(
                        settings.paymentPeriod * 1 days
                    )
                );
            }
        } else {
            // Fixed term loans must pay all outstanding interest payments and fees.
            scalingValue = RAY.mul(paymentsRemaining);
        }

        ILoanFees memory _fees = LoanLib.previewFees(
            settings,
            payment,
            _serviceConfiguration.firstLossFeeBps(),
            IPool(_pool).poolFeePercentOfInterest(),
            block.timestamp,
            paymentDueDate,
            scalingValue
        );

        LoanLib.payFees(
            liquidityAsset,
            IPool(_pool).firstLossVault(),
            IPool(_pool).feeVault(),
            _fees
        );

        LoanLib.completePayment(
            liquidityAsset,
            _pool,
            outstandingPrincipal.add(_fees.interestPayment).add(
                _fees.latePaymentFee
            )
        );
        IPool(_pool).onLoanPrincipalReturned(outstandingPrincipal);

        paymentsRemaining = 0;
        _state = ILoanLifeCycleState.Matured;

        IPool(_pool).onLoanStateTransitioned();
        return payment;
    }

    /**
     * @inheritdoc ILoan
     */
    function markDefaulted()
        external
        override
        onlyPoolController
        atState(ILoanLifeCycleState.Active)
        returns (ILoanLifeCycleState)
    {
        requireNotPaused();
        _state = ILoanLifeCycleState.Defaulted;
        IPool(_pool).onLoanStateTransitioned();
        emit LifeCycleStateTransition(_state);
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function markCallback() external override onlyPoolAdmin {
        requireNotPaused();
        callbackTimestamp = block.timestamp;
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
        return settings.dropDeadTimestamp;
    }

    function duration() external view returns (uint256) {
        return settings.duration;
    }

    function paymentPeriod() external view returns (uint256) {
        return settings.paymentPeriod;
    }

    function apr() external view returns (uint256) {
        return settings.apr;
    }

    function principal() external view returns (uint256) {
        return settings.principal;
    }

    function loanType() external view returns (ILoanType) {
        return settings.loanType;
    }

    function serviceConfiguration()
        external
        view
        returns (IServiceConfiguration)
    {
        return _serviceConfiguration;
    }

    function requireNotPaused() internal view {
        require(
            IServiceConfiguration(_serviceConfiguration).paused() == false,
            "Loan: Protocol paused"
        );
    }
}
