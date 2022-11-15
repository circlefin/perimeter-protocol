// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/IPool.sol";
import "./interfaces/IPoolController.sol";
import "../libraries/PoolLib.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title WithdrawState
 */
contract PoolController is IPoolController {
    IPool public pool;
    address public admin;
    IPoolConfigurableSettings private _settings;
    IPoolLifeCycleState private _state;

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
            "Pool: invalid pool state"
        );
        _;
    }

    constructor(
        address pool_,
        address admin_,
        IPoolConfigurableSettings memory poolSettings_
    ) {
        pool = IPool(pool_);
        admin = admin_;
        _settings = poolSettings_;

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
        onlyAdmin
        atState(IPoolLifeCycleState.Initialized)
    {
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
    function setWithdrawGate(uint256 _withdrawGateBps)
        external
        onlyAdmin
        atInitializedOrActiveState
    {
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
    function setPoolCapacity(uint256 newCapacity) external onlyAdmin {
        require(newCapacity >= pool.totalAssets(), "Pool: invalid capacity");
        _settings.maxCapacity = newCapacity;
        emit PoolSettingsUpdated();
    }

    /**
     * @inheritdoc IPoolController
     */
    function setPoolEndDate(uint256 endDate) external onlyAdmin {
        require(_settings.endDate > endDate, "Pool: can't move end date up");
        require(
            endDate > block.timestamp,
            "Pool: can't move end date into the past"
        );
        _settings.endDate = endDate;
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
    // Actions
    // /////////////////////////////////////////////////

    /**
     * @inheritdoc IPoolController
     */
    function depositFirstLoss(uint256 amount, address spender)
        external
        onlyAdmin
        atInitializedOrActiveState
    {
        pool.transferToFirstLossVault(spender, amount);
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
        onlyAdmin
        atState(IPoolLifeCycleState.Closed)
        returns (uint256)
    {
        require(pool.numFundedLoans() == 0, "Pool: loans still active");

        pool.transferFromFirstLossVault(receiver, amount);

        return
            PoolLib.executeFirstLossWithdraw(
                amount,
                receiver,
                pool.firstLossVault()
            );
    }
}
