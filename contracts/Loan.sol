/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.16;

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./interfaces/IVault.sol";
import "./factories/interfaces/IVaultFactory.sol";
import "./libraries/LoanLib.sol";
import "./upgrades/BeaconImplementation.sol";

/**
 * @title Perimeter Loan contract.
 */
contract Loan is ILoan, BeaconImplementation {
    using SafeMath for uint256;

    IServiceConfiguration private _serviceConfiguration;
    address private _factory;
    ILoanLifeCycleState private _state = ILoanLifeCycleState.Requested;
    address private _borrower;
    address private _pool;
    IVault public collateralVault;
    IVault public fundingVault;
    address[] private _fungibleCollateral;
    ILoanNonFungibleCollateral[] private _nonFungibleCollateral;
    uint256 public createdAt;
    address public liquidityAsset;
    uint256 public payment;
    uint256 public outstandingPrincipal;
    uint256 public paymentsRemaining;
    uint256 public paymentDueDate;
    uint256 public callbackTimestamp;
    ILoanSettings public settings;

    event FundsReclaimed(uint256 amount, address pool);

    /**
     * @dev Modifier that requires the protocol not be paused.
     */
    modifier onlyNotPaused() {
        require(
            IServiceConfiguration(_serviceConfiguration).paused() == false,
            "Loan: Protocol paused"
        );
        _;
    }

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

    function initialize(
        address serviceConfiguration_,
        address factory_,
        address borrower_,
        address pool_,
        address liquidityAsset_,
        address vaultFactory,
        ILoanSettings memory settings_
    ) public virtual initializer {
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration_);
        _factory = factory_;
        _borrower = borrower_;
        _pool = pool_;

        collateralVault = IVault(
            IVaultFactory(vaultFactory).createVault(address(this))
        );
        fundingVault = IVault(
            IVaultFactory(vaultFactory).createVault(address(this))
        );
        createdAt = block.timestamp;
        liquidityAsset = liquidityAsset_;
        settings = settings_;

        LoanLib.validateLoan(
            _serviceConfiguration,
            IPool(_pool),
            settings.duration,
            settings.paymentPeriod,
            settings.principal,
            liquidityAsset
        );

        paymentsRemaining = settings.duration.div(settings.paymentPeriod);
        uint256 paymentsTotal = settings
            .principal
            .mul(settings.apr)
            .mul(settings.duration.mul(LoanLib.RAY).div(360))
            .div(LoanLib.RAY)
            .div(10000);
        payment = paymentsTotal.mul(LoanLib.RAY).div(paymentsRemaining).div(
            LoanLib.RAY
        );
    }

    /**
     * @dev Cancel the Loan
     */
    function cancelRequested()
        external
        onlyNotPaused
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
        onlyNotPaused
        onlyPermittedBorrower
        onlyBorrower
        atState(ILoanLifeCycleState.Collateralized)
        returns (ILoanLifeCycleState)
    {
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
        onlyNotPaused
        atState(ILoanLifeCycleState.Funded)
        returns (ILoanLifeCycleState)
    {
        require(
            msg.sender == _borrower ||
                msg.sender == address(IPool(_pool).poolController()),
            "Loan: invalid caller"
        );
        require(
            settings.dropDeadTimestamp < block.timestamp,
            "Loan: Drop dead date not met"
        );

        LoanLib.returnCanceledLoanPrincipal(
            fundingVault,
            liquidityAsset,
            _pool,
            settings.principal
        );
        _state = ILoanLifeCycleState.Canceled;
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function claimCollateral(
        address[] memory assets,
        ILoanNonFungibleCollateral[] memory nonFungibleAssets
    ) external override onlyNotPaused {
        address recipient;
        if (msg.sender == _borrower) {
            _checkBorrowerCanWithdrawCollateral();
            recipient = _borrower;
        } else {
            // Only the PA or borrower can withdraw collateral.
            _checkAdminCanWithdrawCollateral();
            recipient = IPool(_pool).admin();
        }

        LoanLib.withdrawFungibleCollateral(collateralVault, assets, recipient);
        LoanLib.withdrawNonFungibleCollateral(
            collateralVault,
            nonFungibleAssets,
            recipient
        );
    }

    /**
     * @dev Internal check that a borrower is eligible to withdraw collateral.
     */
    function _checkBorrowerCanWithdrawCollateral()
        internal
        view
        onlyPermittedBorrower
    {
        require(
            _state == ILoanLifeCycleState.Canceled ||
                _state == ILoanLifeCycleState.Matured,
            "Loan: unable to claim collateral"
        );
    }

    /**
     * @dev Internal check that a PA is eligible to withdraw collateral.
     */
    function _checkAdminCanWithdrawCollateral()
        internal
        view
        onlyPoolController
    {
        require(
            _state == ILoanLifeCycleState.Defaulted,
            "Loan: unable to claim collateral"
        );
    }

    /**
     * @inheritdoc ILoan
     */
    function postFungibleCollateral(
        address asset,
        uint256 amount
    )
        external
        virtual
        onlyNotPaused
        onlyPermittedBorrower
        onlyBorrower
        onlyNonTerminalState
        returns (ILoanLifeCycleState)
    {
        require(amount > 0, "Loan: posting 0 collateral");
        _state = LoanLib.postFungibleCollateral(
            address(collateralVault),
            asset,
            amount,
            _state,
            _fungibleCollateral
        );
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function postNonFungibleCollateral(
        address asset,
        uint256 tokenId
    )
        external
        virtual
        onlyNotPaused
        onlyPermittedBorrower
        onlyBorrower
        onlyNonTerminalState
        returns (ILoanLifeCycleState)
    {
        _state = LoanLib.postNonFungibleCollateral(
            address(collateralVault),
            asset,
            tokenId,
            _state,
            _nonFungibleCollateral
        );
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function fund() external onlyPool returns (ILoanLifeCycleState) {
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
     * @inheritdoc ILoan
     */
    function reclaimFunds(uint256 amount) external override onlyPoolController {
        require(settings.loanType == ILoanType.Open);

        fundingVault.withdrawERC20(liquidityAsset, amount, _pool);
        IPool(_pool).onLoanPrincipalReturned(amount);

        emit FundsReclaimed(amount, _pool);
    }

    /**
     * @inheritdoc ILoan
     */
    function drawdown(
        uint256 amount
    )
        external
        virtual
        onlyNotPaused
        onlyPermittedBorrower
        onlyBorrower
        returns (uint256)
    {
        (_state, paymentDueDate) = LoanLib.drawdown(
            amount,
            liquidityAsset,
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
     * @inheritdoc ILoan
     */
    function paydownPrincipal(
        uint256 amount
    ) external onlyNotPaused onlyPermittedBorrower onlyBorrower {
        require(outstandingPrincipal >= amount, "Loan: amount too high");
        require(settings.loanType == ILoanType.Open, "Loan: invalid loan type");
        LoanLib.paydownPrincipal(liquidityAsset, amount, fundingVault);
        outstandingPrincipal -= amount;
    }

    /**
     * @inheritdoc ILoan
     */
    function completeNextPayment()
        external
        override
        onlyNotPaused
        onlyPermittedBorrower
        onlyBorrower
        atState(ILoanLifeCycleState.Active)
    {
        require(paymentsRemaining > 0, "Loan: No more payments remain");
        IPool(_pool).onLoanWillMakePayment();
        ILoanFees memory _fees = LoanLib.previewFees(
            settings,
            payment,
            _serviceConfiguration.firstLossFeeBps(),
            IPool(_pool).serviceFeeBps(),
            block.timestamp,
            paymentDueDate,
            LoanLib.RAY
        );

        LoanLib.payFees(
            liquidityAsset,
            IPool(_pool).firstLossVault(),
            IPool(_pool).feeVault(),
            _fees
        );
        LoanLib.completePayment(liquidityAsset, _pool, _fees.interestPayment);
        paymentsRemaining -= 1;
        if (paymentsRemaining > 0) {
            paymentDueDate += settings.paymentPeriod * 1 days;
        }
    }

    /**
     * @inheritdoc ILoan
     */
    function previewFees(
        uint256 amount
    ) public view returns (ILoanFees memory) {
        return
            LoanLib.previewFees(
                settings,
                amount,
                _serviceConfiguration.firstLossFeeBps(),
                IPool(_pool).serviceFeeBps(),
                block.timestamp,
                paymentDueDate,
                LoanLib.RAY
            );
    }

    /**
     * @inheritdoc ILoan
     */
    function completeFullPayment()
        external
        override
        onlyNotPaused
        onlyPermittedBorrower
        onlyBorrower
        atState(ILoanLifeCycleState.Active)
    {
        IPool(_pool).onLoanWillMakePayment();
        uint256 scalingValue = LoanLib.RAY;

        if (settings.loanType == ILoanType.Open) {
            // If an open term loan payment is not overdue, we will prorate the
            // payment
            if (paymentDueDate > block.timestamp) {
                // Calculate the scaling value
                // LoanLib.RAY - ((paymentDueDate - blocktimestamp) * LoanLib.RAY / paymentPeriod (seconds))
                scalingValue = LoanLib.RAY.sub(
                    (paymentDueDate - block.timestamp).mul(LoanLib.RAY).div(
                        settings.paymentPeriod * 1 days
                    )
                );
            }
        } else {
            // Fixed term loans must pay all outstanding interest payments and fees.
            scalingValue = LoanLib.RAY.mul(paymentsRemaining);
        }

        ILoanFees memory _fees = LoanLib.previewFees(
            settings,
            payment,
            _serviceConfiguration.firstLossFeeBps(),
            IPool(_pool).serviceFeeBps(),
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
            outstandingPrincipal.add(_fees.interestPayment)
        );
        IPool(_pool).onLoanPrincipalReturned(outstandingPrincipal);

        paymentsRemaining = 0;
        _state = ILoanLifeCycleState.Matured;

        IPool(_pool).onLoanStateTransitioned();
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
        _state = ILoanLifeCycleState.Defaulted;
        IPool(_pool).onLoanStateTransitioned();
        emit LifeCycleStateTransition(_state);
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function markCallback() external override onlyPoolController {
        callbackTimestamp = block.timestamp;
    }

    /**
     * @inheritdoc ILoan
     */
    function fungibleCollateral() external view returns (address[] memory) {
        return _fungibleCollateral;
    }

    /**
     * @inheritdoc ILoan
     */
    function nonFungibleCollateral()
        external
        view
        returns (ILoanNonFungibleCollateral[] memory)
    {
        return _nonFungibleCollateral;
    }

    /**
     * @inheritdoc ILoan
     */
    function state() external view returns (ILoanLifeCycleState) {
        return _state;
    }

    /**
     * @inheritdoc ILoan
     */
    function borrower() external view returns (address) {
        return _borrower;
    }

    /**
     * @inheritdoc ILoan
     */
    function pool() external view returns (address) {
        return _pool;
    }

    /**
     * @inheritdoc ILoan
     */
    function factory() external view returns (address) {
        return _factory;
    }

    /**
     * @inheritdoc ILoan
     */
    function dropDeadTimestamp() external view returns (uint256) {
        return settings.dropDeadTimestamp;
    }

    /**
     * @inheritdoc ILoan
     */
    function duration() external view returns (uint256) {
        return settings.duration;
    }

    /**
     * @inheritdoc ILoan
     */
    function paymentPeriod() external view returns (uint256) {
        return settings.paymentPeriod;
    }

    /**
     * @inheritdoc ILoan
     */
    function apr() external view returns (uint256) {
        return settings.apr;
    }

    /**
     * @inheritdoc ILoan
     */
    function principal() external view returns (uint256) {
        return settings.principal;
    }

    /**
     * @inheritdoc ILoan
     */
    function loanType() external view returns (ILoanType) {
        return settings.loanType;
    }

    /**
     * @inheritdoc ILoan
     */
    function serviceConfiguration()
        external
        view
        returns (IServiceConfiguration)
    {
        return _serviceConfiguration;
    }
}
