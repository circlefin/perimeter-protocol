// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/IPool.sol";
import "./interfaces/IPoolController.sol";
import "../libraries/PoolLib.sol";
import "../FirstLossVault.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../upgrades/BeaconImplementation.sol";

/**
 * @title WithdrawState
 */
contract PoolController is IPoolController, BeaconImplementation {
    using SafeERC20 for IERC20;

    IPool public pool;
    address public admin;
    address public serviceConfiguration;
    IPoolConfigurableSettings private _settings;
    IPoolLifeCycleState private _state;
    FirstLossVault private _firstLossVault;
    IERC20 private _liquidityAsset;

    /**
     * @dev Modifier that checks that the protocol is not paused.
     */
    modifier onlyNotPaused() {
        require(
            IServiceConfiguration(serviceConfiguration).paused() == false,
            "Pool: Protocol paused"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the caller is the pool's admin.
     */
    modifier onlyAdmin() {
        require(
            admin != address(0) && msg.sender == admin,
            "Pool: caller is not admin"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atState(IPoolLifeCycleState state_) {
        require(state() == state_, "Pool: FunctionInvalidAtThisLifeCycleState");
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atInitializedOrActiveState() {
        IPoolLifeCycleState _currentState = state();

        require(
            _currentState == IPoolLifeCycleState.Active ||
                _currentState == IPoolLifeCycleState.Initialized,
            "Pool: FunctionInvalidAtThisLifeCycleState"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atActiveOrClosedState() {
        IPoolLifeCycleState _currentState = state();

        require(
            _currentState == IPoolLifeCycleState.Active ||
                _currentState == IPoolLifeCycleState.Closed,
            "Pool: FunctionInvalidAtThisLifeCycleState"
        );
        _;
    }

    /**
     * @dev Modifier to check that an addres is a Perimeter loan associated
     * with this pool.
     */
    modifier isPoolLoan(address loan) {
        require(
            PoolLib.isPoolLoan(loan, serviceConfiguration, address(pool)),
            "Pool: invalid loan"
        );
        _;
    }

    /**
     * @dev Modifier to ensure that the Pool is cranked.
     */
    modifier onlyCrankedPool() {
        pool.crank();
        _;
    }

    function initialize(
        address pool_,
        address serviceConfiguration_,
        address admin_,
        address liquidityAsset_,
        IPoolConfigurableSettings memory poolSettings_
    ) public initializer {
        serviceConfiguration = serviceConfiguration_;
        pool = IPool(pool_);

        admin = admin_;
        _settings = poolSettings_;

        _liquidityAsset = IERC20(liquidityAsset_);
        _liquidityAsset.safeApprove(address(this), type(uint256).max);

        _firstLossVault = new FirstLossVault(address(this), liquidityAsset_);
        _setState(IPoolLifeCycleState.Initialized);
    }

    /*//////////////////////////////////////////////////////////////
                Settings
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolController
     */
    function settings()
        external
        view
        returns (IPoolConfigurableSettings memory)
    {
        return _settings;
    }

    /**
     * @inheritdoc IPoolController
     */
    function setRequestFee(uint256 feeBps)
        external
        onlyNotPaused
        onlyAdmin
        atState(IPoolLifeCycleState.Initialized)
    {
        require(feeBps <= 10_000, "Pool: fee too large");
        _settings.requestFeeBps = feeBps;
    }

    /**
     * @inheritdoc IPoolController
     */
    function requestFee(uint256 sharesOrAssets)
        public
        view
        returns (uint256 feeShares)
    {
        feeShares = PoolLib.calculateRequestFee(
            sharesOrAssets,
            _settings.requestFeeBps
        );
    }

    /**
     * @inheritdoc IPoolController
     */
    function setRequestCancellationFee(uint256 feeBps)
        external
        onlyNotPaused
        onlyAdmin
        atState(IPoolLifeCycleState.Initialized)
    {
        require(feeBps <= 10_000, "Pool: fee too large");
        _settings.requestCancellationFeeBps = feeBps;
    }

    /**
     * @inheritdoc IPoolController
     */
    function requestCancellationFee(uint256 sharesOrAssets)
        public
        view
        returns (uint256 feeShares)
    {
        feeShares = PoolLib.calculateCancellationFee(
            sharesOrAssets,
            _settings.requestCancellationFeeBps
        );
    }

    /**
     * @inheritdoc IPoolController
     */
    function setWithdrawGate(uint256 _withdrawGateBps)
        external
        onlyNotPaused
        onlyAdmin
        atInitializedOrActiveState
    {
        require(_withdrawGateBps <= 10_000, "Pool: invalid bps");
        _settings.withdrawGateBps = _withdrawGateBps;
    }

    /**
     * @inheritdoc IPoolController
     */
    function withdrawGate() public view returns (uint256) {
        if (state() == IPoolLifeCycleState.Closed) {
            return 10_000;
        }

        return _settings.withdrawGateBps;
    }

    /**
     * @inheritdoc IPoolController
     */
    function withdrawRequestPeriodDuration() public view returns (uint256) {
        return
            Math.min(
                _settings.withdrawRequestPeriodDuration,
                state() == IPoolLifeCycleState.Closed
                    ? 1 days
                    : _settings.withdrawRequestPeriodDuration
            );
    }

    /**
     * @inheritdoc IPoolController
     */
    function setPoolCapacity(uint256 newCapacity)
        external
        onlyNotPaused
        onlyAdmin
    {
        require(newCapacity >= pool.totalAssets(), "Pool: invalid capacity");
        _settings.maxCapacity = newCapacity;
        emit PoolSettingsUpdated();
    }

    /**
     * @inheritdoc IPoolController
     */
    function setPoolEndDate(uint256 endDate) external onlyNotPaused onlyAdmin {
        require(_settings.endDate > endDate, "Pool: can't move end date up");
        require(
            endDate > block.timestamp,
            "Pool: can't move end date into the past"
        );
        _settings.endDate = endDate;
        emit PoolSettingsUpdated();
    }

    /**
     * @inheritdoc IPoolController
     */
    function firstLossVault() external view returns (address) {
        return address(_firstLossVault);
    }

    /**
     * @inheritdoc IPoolController
     */
    function firstLossBalance() external view returns (uint256) {
        return _liquidityAsset.balanceOf(address(_firstLossVault));
    }

    /**
     * @inheritdoc IPoolController
     */
    function setServiceFeeBps(uint256 serviceFeeBps)
        external
        onlyNotPaused
        onlyAdmin
    {
        require(serviceFeeBps <= 10000, "Pool: invalid service fee");
        _settings.serviceFeeBps = serviceFeeBps;
        emit PoolSettingsUpdated();
    }

    /**
     * @inheritdoc IPoolController
     */
    function setFixedFee(uint256 amount, uint256 interval)
        external
        onlyNotPaused
        onlyAdmin
    {
        if (amount > 0) {
            require(interval > 0, "Pool: invalid fixed fee");
        }
        _settings.fixedFee = amount;
        _settings.fixedFeeInterval = interval;
        emit PoolSettingsUpdated();
    }

    /*//////////////////////////////////////////////////////////////
                State
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolController
     */
    function state() public view returns (IPoolLifeCycleState) {
        if (block.timestamp >= _settings.endDate) {
            return IPoolLifeCycleState.Closed;
        }

        return _state;
    }

    /**
     * @inheritdoc IPoolController
     */
    function isInitializedOrActive() external view returns (bool) {
        IPoolLifeCycleState _currentState = state();

        return
            _currentState == IPoolLifeCycleState.Initialized ||
            _currentState == IPoolLifeCycleState.Active;
    }

    /**
     * @inheritdoc IPoolController
     */
    function isActiveOrClosed() external view returns (bool) {
        IPoolLifeCycleState _currentState = state();

        return
            _currentState == IPoolLifeCycleState.Active ||
            _currentState == IPoolLifeCycleState.Closed;
    }

    /**
     * @dev Set the pool lifecycle state. If the state changes, this method
     * will also update the activatedAt variable
     */
    function _setState(IPoolLifeCycleState newState) internal {
        if (_state != newState) {
            if (
                newState == IPoolLifeCycleState.Active &&
                pool.activatedAt() == 0
            ) {
                pool.onActivated();
            }

            _state = newState;
            emit LifeCycleStateTransition(newState);
        }
    }

    // /////////////////////////////////////////////////
    // First Loss
    // /////////////////////////////////////////////////

    /**
     * @inheritdoc IPoolController
     */
    function depositFirstLoss(uint256 amount, address spender)
        external
        onlyNotPaused
        onlyAdmin
        atInitializedOrActiveState
    {
        // not sure we need thos
        require(address(_firstLossVault) != address(0), "Pool: 0 address");
        _liquidityAsset.safeTransferFrom(
            spender,
            address(_firstLossVault),
            amount
        );

        IPoolLifeCycleState poolLifeCycleState = PoolLib
            .executeFirstLossDeposit(
                pool.asset(),
                spender,
                amount,
                pool.firstLossVault(),
                state(),
                _settings.firstLossInitialMinimum
            );

        _setState(poolLifeCycleState);
    }

    /**
     * @inheritdoc IPoolController
     */
    function withdrawFirstLoss(uint256 amount, address receiver)
        external
        onlyNotPaused
        onlyAdmin
        atState(IPoolLifeCycleState.Closed)
        returns (uint256)
    {
        require(pool.numActiveLoans() == 0, "Pool: loans still active");
        require(address(_firstLossVault) != address(0), "Pool: 0 address");
        require(receiver != address(0), "Pool: 0 address");

        _firstLossVault.withdraw(amount, receiver);

        return
            PoolLib.executeFirstLossWithdraw(
                amount,
                receiver,
                pool.firstLossVault()
            );
    }

    /*//////////////////////////////////////////////////////////////
                Loans
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolController
     */
    function fundLoan(address addr)
        external
        onlyNotPaused
        onlyAdmin
        atState(IPoolLifeCycleState.Active)
        isPoolLoan(addr)
    {
        pool.fundLoan(addr);
    }

    /**
     * @inheritdoc IPoolController
     */
    function defaultLoan(address loan)
        external
        onlyNotPaused
        onlyAdmin
        atActiveOrClosedState
        onlyCrankedPool
    {
        require(loan != address(0), "Pool: 0 address");
        require(pool.isActiveLoan(loan), "Pool: not active loan");

        PoolLib.executeDefault(
            address(_liquidityAsset),
            address(_firstLossVault),
            loan,
            address(pool)
        );
    }

    /*//////////////////////////////////////////////////////////////
                Fees
    //////////////////////////////////////////////////////////////*/

    function claimFixedFee() external onlyNotPaused onlyAdmin {
        pool.claimFixedFee(
            msg.sender,
            _settings.fixedFee,
            _settings.fixedFeeInterval
        );
    }

    /*//////////////////////////////////////////////////////////////
                Crank
    //////////////////////////////////////////////////////////////*/

    function crank() external override onlyNotPaused onlyAdmin {
        pool.crank();
    }
}
