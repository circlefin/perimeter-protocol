// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/IPool.sol";
import "./interfaces/IWithdrawController.sol";
import "./interfaces/IPoolController.sol";
import "../libraries/PoolLib.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

/**
 * @title WithdrawState
 */
contract WithdrawController is IWithdrawController {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev A reference to the pool for this withdraw state
     */
    IPool private _pool;

    /**
     * @dev Per-lender withdraw request information
     */
    mapping(address => IPoolWithdrawState) private _withdrawState;

    /**
     * @dev a list of all addresses that have requested a withdrawal from this
     * pool. This allows us to iterate over them to perform a withdrawal/redeem.
     */
    EnumerableSet.AddressSet private _withdrawAddresses;

    /**
     * @dev Aggregate withdraw request information
     */
    IPoolWithdrawState private _globalWithdrawState;

    /**
     * @dev Mapping of withdrawPeriod to snapshot
     */
    mapping(uint256 => IPoolSnapshotState) private _snapshots;

    /**
     * @dev Max snapshots to process per crank
     */
    uint256 constant MAX_SNAPSHOTS_PER_CRANK = 30;

    /**
     * @dev Modifier that checks that the caller is a pool lender
     */
    modifier onlyPool() {
        require(address(_pool) == msg.sender, "WithdrawController: Not Pool");
        _;
    }

    /**
     * @dev Constructor for a Pool's withdraw state
     */
    constructor(address pool) {
        _pool = IPool(pool);
    }

    /*//////////////////////////////////////////////////////////////
                        State Views
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev The current withdraw period. Funds marked with this period (or
     * earlier), are eligible to be considered for redemption/widrawal.
     *
     * TODO: This can be internal
     */
    function withdrawPeriod() public view returns (uint256 period) {
        period = PoolLib.calculateCurrentWithdrawPeriod(
            block.timestamp,
            _pool.activatedAt(),
            _pool.settings().withdrawRequestPeriodDuration
        );
    }

    /**
     * @dev Returns the current withdraw state of an owner.
     */
    function _currentWithdrawState(address owner)
        internal
        view
        returns (IPoolWithdrawState memory state)
    {
        uint256 currentPeriod = withdrawPeriod();
        state = PoolLib.progressWithdrawState(
            _withdrawState[owner],
            currentPeriod
        );

        return
            simulateCrank(state, currentPeriod - state.latestCrankPeriod + 1);
    }

    /**
     * @dev Returns the current global withdraw state.
     */
    function _currentGlobalWithdrawState()
        internal
        view
        returns (IPoolWithdrawState memory state)
    {
        state = PoolLib.progressWithdrawState(
            _globalWithdrawState,
            withdrawPeriod()
        );
    }

    /*//////////////////////////////////////////////////////////////
                            Balance Views
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function interestBearingBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _pool.balanceOf(owner) - maxRedeem(owner);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function requestedBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _currentWithdrawState(owner).requestedShares;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function totalRequestedBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().requestedShares;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function eligibleBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _currentWithdrawState(owner).eligibleShares;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function totalEligibleBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().eligibleShares;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function totalRedeemableShares() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().redeemableShares;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function totalWithdrawableAssets() external view returns (uint256 assets) {
        assets = _currentGlobalWithdrawState().withdrawableAssets;
    }

    /*//////////////////////////////////////////////////////////////
                            Max Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function maxRedeemRequest(address owner)
        external
        view
        returns (uint256 maxShares)
    {
        maxShares = PoolLib.calculateMaxRedeemRequest(
            _currentWithdrawState(owner),
            _pool.balanceOf(owner),
            _pool.settings().requestFeeBps
        );
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function maxRedeem(address owner) public view returns (uint256 maxShares) {
        maxShares = _currentWithdrawState(owner).redeemableShares;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function maxWithdraw(address owner) external view returns (uint256 assets) {
        assets = _currentWithdrawState(owner).withdrawableAssets;
    }

    /*//////////////////////////////////////////////////////////////
                            Preview Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function previewRedeemRequest(uint256 shares)
        external
        view
        returns (uint256 assets)
    {
        uint256 shareFees = PoolLib.calculateRequestFee(
            shares,
            _pool.settings().requestFeeBps
        );

        assets = _pool.convertToAssets(shares - shareFees);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewWithdrawRequest(uint256 assets)
        external
        view
        returns (uint256 shares)
    {
        uint256 assetFees = PoolLib.calculateRequestFee(
            assets,
            _pool.settings().requestFeeBps
        );

        shares = _pool.convertToShares(assets + assetFees);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewRedeem(address owner, uint256 shares)
        external
        view
        returns (uint256 assets)
    {
        assets = PoolLib.calculateConversion(
            shares,
            _currentWithdrawState(owner).withdrawableAssets,
            _currentWithdrawState(owner).redeemableShares,
            false
        );
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewWithdraw(address owner, uint256 assets)
        external
        view
        returns (uint256 shares)
    {
        IPoolWithdrawState memory withdrawState = _currentWithdrawState(
            msg.sender
        );
        shares = PoolLib.calculateConversion(
            assets,
            withdrawState.redeemableShares,
            withdrawState.withdrawableAssets,
            true
        );
    }

    /*//////////////////////////////////////////////////////////////
                            Request Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function performRequest(address owner, uint256 shares) external onlyPool {
        crankFully(owner);

        uint256 currentPeriod = withdrawPeriod();

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.calculateWithdrawStateForRequest(
            _currentWithdrawState(owner),
            currentPeriod,
            shares
        );

        // Update the global amount
        _globalWithdrawState = PoolLib.calculateWithdrawStateForRequest(
            _globalWithdrawState,
            currentPeriod,
            shares
        );
    }

    /*//////////////////////////////////////////////////////////////
                        Cancellation Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function maxRequestCancellation(address owner)
        public
        view
        returns (uint256 maxShares)
    {
        maxShares = PoolLib.calculateMaxCancellation(
            _currentWithdrawState(owner),
            _pool.settings().requestCancellationFeeBps
        );
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function performRequestCancellation(address owner, uint256 shares)
        external
        onlyPool
    {
        crankFully(owner);
        uint256 currentPeriod = withdrawPeriod();

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.calculateWithdrawStateForCancellation(
            _currentWithdrawState(owner),
            currentPeriod,
            shares
        );

        // Update the global amount
        _globalWithdrawState = PoolLib.calculateWithdrawStateForCancellation(
            _globalWithdrawState,
            currentPeriod,
            shares
        );
    }

    /*//////////////////////////////////////////////////////////////
                            Crank
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function crankPool() external onlyPool returns (uint256 redeemableShares) {
        uint256 currentPeriod = withdrawPeriod();
        IPoolWithdrawState memory globalState = _currentGlobalWithdrawState();
        if (globalState.latestCrankPeriod == currentPeriod) {
            return 0;
        }

        // Calculate the amount available for withdrawal
        uint256 liquidAssets = _pool.liquidityPoolAssets();
        IPoolController _poolController = IPoolController(
            _pool.poolController()
        );

        uint256 availableAssets = liquidAssets
            .mul(_poolController.withdrawGate())
            .mul(PoolLib.RAY)
            .div(10_000)
            .div(PoolLib.RAY);

        uint256 availableShares = _pool.convertToShares(availableAssets);

        if (availableAssets <= 0 || availableShares <= 0) {
            // unable to redeem anything
            redeemableShares = 0;
            return 0;
        }

        // Determine the amount of shares that we will actually distribute.
        redeemableShares = Math.min(
            availableShares,
            globalState.eligibleShares
        );

        // Calculate the redeemable rate for each lender
        uint256 redeemableRateRay = redeemableShares.mul(PoolLib.RAY).div(
            globalState.eligibleShares
        );
        uint256 withdrawableAssets = _pool.convertToAssets(redeemableShares);

        // Record snapshot
        _snapshots[currentPeriod] = IPoolSnapshotState(
            redeemableRateRay,
            withdrawableAssets.mul(PoolLib.RAY).div(redeemableShares)
        );

        // New stuff
        uint256 fxExchangeRate = withdrawableAssets.mul(PoolLib.RAY).div(
            redeemableShares
        );

        // First period
        uint256 newAggregation = redeemableRateRay;
        uint256 newDifference = PoolLib.RAY - redeemableRateRay;

        if (!hasProcessed) {
            _aggregateAccumulations[currentPeriod] = newAggregation;
            _aggregateDifferences[currentPeriod] = newDifference;

            _aggregateAccumulationsFx[currentPeriod] = newAggregation
                .mul(fxExchangeRate)
                .div(PoolLib.RAY);

            // _aggregateDifferencesFx[currentPeriod] = newDifference
            //     .mul(fxExchangeRate)
            //     .div(PoolLib.RAY);
        } else {
            // Accumulations
            _aggregateAccumulations[currentPeriod] =
                _aggregateAccumulations[lastWindowProcessed] +
                (redeemableRateRay *
                    _aggregateDifferences[lastWindowProcessed]) /
                PoolLib.RAY;

            _aggregateAccumulationsFx[
                currentPeriod
            ] = _aggregateAccumulationsFx[lastWindowProcessed].add(
                redeemableRateRay
                    .mul(_aggregateDifferences[lastWindowProcessed])
                    .div(PoolLib.RAY)
                    .mul(fxExchangeRate)
                    .div(PoolLib.RAY)
            );

            // Differences
            _aggregateDifferences[currentPeriod] =
                (newDifference * _aggregateDifferences[lastWindowProcessed]) /
                PoolLib.RAY;

            // _aggregateDifferencesFx[currentPeriod] = newDifference
            //     .mul(fxExchangeRate)
            //     .div(PoolLib.RAY)
            //     .mul(_aggregateDifferencesFx[lastWindowProcessed])
            //     .div(PoolLib.RAY);
        }

        // Update the global withdraw state
        globalState = PoolLib.updateWithdrawStateForWithdraw(
            globalState,
            _pool.convertToAssets(redeemableShares),
            redeemableShares
        );
        globalState.latestCrankPeriod = currentPeriod;
        _globalWithdrawState = globalState;
        hasProcessed = true;
        lastWindowProcessed = currentPeriod;

        if (!firstCrankWindowSet) {
            firstCrankWindow = currentPeriod;
            firstCrankWindowSet = true;
        }
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function crankIncrementally(address owner) external override {
        uint256 currentPeriod = withdrawPeriod();
        IPoolWithdrawState memory state = PoolLib.progressWithdrawState(
            _withdrawState[owner],
            currentPeriod
        );

        _withdrawState[owner] = simulateCrank(state, MAX_SNAPSHOTS_PER_CRANK);
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function needsCrank(address owner) external view override returns (bool) {
        return
            _withdrawState[owner].latestCrankPeriod <
            _globalWithdrawState.latestCrankPeriod;
    }

    struct AccumulationMath {
        uint256 accumulationTotal;
        uint256 accumulationOffset;
        uint256 accumulationDivisor;
    }

    /**
     * @dev Simulates the effects of multiple snapshots against a lenders
     * requested withdrawal.
     */
    function simulateCrank(
        IPoolWithdrawState memory withdrawState,
        uint256 maxSnapshots
    ) internal view returns (IPoolWithdrawState memory) {
        uint256 currentPeriod = withdrawPeriod();
        uint256 lastPoolCrank = _globalWithdrawState.latestCrankPeriod;

        // No further cranking needed
        if (withdrawState.latestCrankPeriod == currentPeriod) {
            return withdrawState;
        }

        // Start from the latest time cranked, or the last time requested,
        // +1
        uint256 crankFrom = Math.max(
            withdrawState.latestRequestPeriod,
            withdrawState.latestCrankPeriod
        ) + 1;

        // Exit early if the global crank hasn't been run in the current period
        if (crankFrom > lastPoolCrank) {
            return withdrawState;
        }

        AccumulationMath memory math = AccumulationMath(0, 0, 0);

        bool needsOffset = crankFrom != firstCrankWindow && firstCrankWindowSet;
        console.log("NEEDS OFFSET");
        console.log(currentPeriod);
        console.log(firstCrankWindow);
        console.log(crankFrom);
        console.log(firstCrankWindowSet);
        console.log(needsOffset);
        if (!hasProcessed) {
            math.accumulationTotal = 0;
            math.accumulationOffset = 0;
            math.accumulationDivisor = 1;
        } else {
            math.accumulationTotal = _aggregateAccumulations[lastPoolCrank];
            math.accumulationOffset = needsOffset
                ? _aggregateAccumulations[crankFrom - 1]
                : 0;

            math.accumulationDivisor = needsOffset
                ? _aggregateDifferences[crankFrom - 1]
                : 1;
        }

        uint256 sharesEligible = withdrawState.eligibleShares.mul(
            math.accumulationTotal - math.accumulationOffset
        );

        sharesEligible = sharesEligible
            .mul(needsOffset ? PoolLib.RAY : 1)
            .div(math.accumulationDivisor)
            .div(PoolLib.RAY);

        // assets!
        if (!hasProcessed) {
            math.accumulationTotal = 0;
            math.accumulationOffset = 0;
            math.accumulationDivisor = 1;
        } else {
            math.accumulationTotal = _aggregateAccumulationsFx[lastPoolCrank];
            math.accumulationOffset = needsOffset
                ? _aggregateAccumulationsFx[crankFrom - 1]
                : 0;
            math.accumulationDivisor = needsOffset
                ? _aggregateDifferences[crankFrom - 1]
                : 1;
        }

        uint256 assetsWithdrawable = withdrawState.eligibleShares.mul(
            math.accumulationTotal - math.accumulationOffset
        );

        assetsWithdrawable = assetsWithdrawable
            .mul(needsOffset ? PoolLib.RAY : 1)
            .div(math.accumulationDivisor)
            .div(PoolLib.RAY);

        console.log("Withdrawable");
        console.log(assetsWithdrawable);

        withdrawState.withdrawableAssets += assetsWithdrawable;
        withdrawState.redeemableShares += sharesEligible;
        withdrawState.eligibleShares -= sharesEligible;

        withdrawState.latestCrankPeriod = lastPoolCrank;

        return withdrawState;
    }

    uint256 firstCrankWindow;
    bool firstCrankWindowSet;

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function crankFully(address addr) public override {
        _withdrawState[addr] = _currentWithdrawState(addr);
    }

    /*//////////////////////////////////////////////////////////////
                            Withdraw / Redeem
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function redeem(address owner, uint256 shares)
        external
        onlyPool
        returns (uint256 assets)
    {
        // Calculate how many assets should be transferred
        IPoolWithdrawState memory state = _currentWithdrawState(owner);
        assets = PoolLib.calculateConversion(
            shares,
            state.withdrawableAssets,
            state.redeemableShares,
            false
        );

        _performWithdraw(owner, shares, assets);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function withdraw(address owner, uint256 assets)
        external
        onlyPool
        returns (uint256 shares)
    {
        // Calculate how many shares should be burned
        IPoolWithdrawState memory state = _currentWithdrawState(owner);
        shares = PoolLib.calculateConversion(
            assets,
            state.redeemableShares,
            state.withdrawableAssets,
            true
        );

        _performWithdraw(owner, shares, assets);
    }

    /**
     * @dev Perform the state update for a withdraw
     */
    function _performWithdraw(
        address owner,
        uint256 shares,
        uint256 assets
    ) internal {
        crankFully(owner);
        IPoolWithdrawState memory currentState = _currentWithdrawState(owner);

        require(
            assets <= _currentWithdrawState(owner).withdrawableAssets,
            "Pool: InsufficientBalance"
        );

        require(
            shares <= _currentWithdrawState(owner).redeemableShares,
            "Pool: InsufficientBalance"
        );

        // update the withdrawState to account for these shares being
        // removed from "withdrawable"
        _withdrawState[owner].redeemableShares -= shares;
        _withdrawState[owner].withdrawableAssets -= assets;
        _globalWithdrawState.redeemableShares -= shares;
        _globalWithdrawState.withdrawableAssets -= assets;
    }
}
