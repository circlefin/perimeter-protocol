// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/IPool.sol";
import "./interfaces/IWithdrawController.sol";
import "./interfaces/IPoolController.sol";
import "../libraries/PoolLib.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../upgrades/BeaconImplementation.sol";

/**
 * @title A Pool's withdraw controller.
 * @dev Deployed as a beacon proxy contract.
 */
contract WithdrawController is IWithdrawController, BeaconImplementation {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant RAY = 10**27;

    /**
     * @dev A reference to the pool for this withdraw state
     */
    IPool private _pool;

    /**
     * @dev Per-lender withdraw request information
     */
    mapping(address => IPoolWithdrawState) private _withdrawState;

    /**
     * @dev Aggregate withdraw request information
     */
    IPoolWithdrawState private _globalWithdrawState;

    /**
     * @dev Mapping of withdrawPeriod to snapshot
     */
    mapping(uint256 => IPoolSnapshotState) private _snapshots;

    /**
     * @dev Modifier that checks that the caller is a pool lender
     */
    modifier onlyPool() {
        require(address(_pool) == msg.sender, "WithdrawController: Not Pool");
        _;
    }

    /**
     * @dev Initializer for a Pool's withdraw state
     */
    function initialize(address pool) public initializer {
        _pool = IPool(pool);
    }

    /*//////////////////////////////////////////////////////////////
                               State Views
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev The current withdraw period. Funds marked with this period (or
     * earlier), are eligible to be considered for redemption/widrawal.
     */
    function withdrawPeriod() public view returns (uint256 period) {
        period = PoolLib.calculateCurrentWithdrawPeriod(
            block.timestamp,
            _pool.activatedAt(),
            _pool.poolController().withdrawRequestPeriodDuration()
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
        assets = _pool.convertToAssets(shares);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewRedeemRequestFees(uint256 shares)
        external
        view
        returns (uint256 feeShares)
    {
        feeShares = PoolLib.calculateRequestFee(
            shares,
            _pool.settings().requestFeeBps
        );
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewWithdrawRequest(uint256 assets)
        external
        view
        returns (uint256 shares)
    {
        shares = _pool.convertToShares(assets);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewWithdrawRequestFees(uint256 assets)
        external
        view
        returns (uint256 feeShares)
    {
        uint256 assetFees = PoolLib.calculateRequestFee(
            assets,
            _pool.settings().requestFeeBps
        );

        feeShares = _pool.convertToShares(assetFees);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function previewRedeem(address owner, uint256 shares)
        external
        view
        returns (uint256 assets)
    {
        IPoolWithdrawState memory withdrawState = _currentWithdrawState(owner);
        assets = PoolLib.calculateAssetsFromShares(
            shares,
            withdrawState.withdrawableAssets,
            withdrawState.redeemableShares,
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
        IPoolWithdrawState memory withdrawState = _currentWithdrawState(owner);
        shares = PoolLib.calculateSharesFromAssets(
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
        IPoolWithdrawState memory _state = _currentWithdrawState(owner);
        require(
            !_claimRequired(_state),
            "WithdrawController: must claim snapshots first"
        );

        uint256 currentPeriod = withdrawPeriod();

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.calculateWithdrawStateForRequest(
            _state,
            currentPeriod,
            shares
        );

        // Either the owner has no outstanding requested / eligible shares, at which
        // point we can treat this time of request as being "up-to-date" with the snapshots.
        // Or, since claimRequired was enforced, they're up-to-date regardless.
        _withdrawState[owner].latestSnapshotPeriod = _globalWithdrawState
            .latestSnapshotPeriod;

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
            _currentWithdrawState(owner)
        );
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function performRequestCancellation(address owner, uint256 shares)
        external
        onlyPool
    {
        require(
            !claimRequired(owner),
            "WithdrawController: must claim eligible first"
        );
        uint256 currentPeriod = withdrawPeriod();

        // Update the requested amount from the user
        IPoolWithdrawState memory lenderState = _currentWithdrawState(owner);
        uint256 requestedSharesPrior = lenderState.requestedShares;
        uint256 eligibleSharesPrior = lenderState.eligibleShares;

        lenderState = PoolLib.calculateWithdrawStateForCancellation(
            lenderState,
            shares
        );
        _withdrawState[owner] = lenderState;

        // Update the global amount
        // We adjust the requested and eligible balances based on the
        // lenders adjusted state post-cancellation.
        _globalWithdrawState = PoolLib.progressWithdrawState(
            _globalWithdrawState,
            currentPeriod
        );
        _globalWithdrawState.requestedShares -=
            requestedSharesPrior -
            lenderState.requestedShares;
        _globalWithdrawState.eligibleShares -=
            eligibleSharesPrior -
            lenderState.eligibleShares;
    }

    /*//////////////////////////////////////////////////////////////
                                Snapshot
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IWithdrawController
     */
    function snapshot(uint256 withdrawGate)
        external
        onlyPool
        returns (
            uint256 period,
            uint256 redeemableShares,
            uint256 withdrawableAssets,
            bool periodSnapshotted
        )
    {
        period = withdrawPeriod();
        IPoolWithdrawState memory globalState = _currentGlobalWithdrawState();

        if (globalState.latestSnapshotPeriod == period) {
            return (period, 0, 0, false);
        }

        // Calculate the amount available for withdrawal
        uint256 liquidAssets = _pool.liquidityPoolAssets();
        uint256 availableAssets = liquidAssets
            .mul(withdrawGate)
            .mul(RAY)
            .div(10_000)
            .div(RAY);

        uint256 availableShares = _pool.convertToShares(availableAssets);

        // Determine the amount of shares that we will actually distribute.
        redeemableShares = Math.min(
            availableShares,
            globalState.eligibleShares
        );

        periodSnapshotted = true;
        withdrawableAssets = _pool.convertToAssets(redeemableShares);

        // Calculate the redeemable rate for each lender
        uint256 redeemableRateRay = globalState.eligibleShares > 0
            ? redeemableShares.mul(RAY).div(globalState.eligibleShares)
            : 0;

        _snapshots[period] = IPoolSnapshotState(
            redeemableRateRay,
            redeemableShares,
            redeemableShares > 0
                ? withdrawableAssets.mul(RAY).div(redeemableShares)
                : 0,
            0
        );

        // Update the global withdraw state to earmark those funds
        globalState = PoolLib.updateWithdrawStateForWithdraw(
            globalState,
            withdrawableAssets,
            redeemableShares
        );

        // "Point" the prior snapshot to this one
        _snapshots[globalState.latestSnapshotPeriod]
            .nextSnapshotPeriod = period;

        // Update the global state
        globalState.latestSnapshotPeriod = period;
        _globalWithdrawState = globalState;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function claimRequired(address lender) public view returns (bool) {
        IPoolWithdrawState memory _state = _currentWithdrawState(lender);
        return _claimRequired(_state);
    }

    /**
     * @dev Internal function used to avoid duplicate calls to _currentWithdrawState.
     */
    function _claimRequired(IPoolWithdrawState memory state)
        internal
        view
        returns (bool)
    {
        return
            state.eligibleShares > 0 &&
            state.latestSnapshotPeriod <
            _globalWithdrawState.latestSnapshotPeriod;
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function claimSnapshots(address lender, uint256 limit)
        external
        onlyPool
        returns (uint256 sharesRedeemable, uint256 assetsWithdrawable)
    {
        require(limit > 0, "WithdrawController: invalid limit");
        IPoolWithdrawState memory withdrawState = _currentWithdrawState(lender);
        uint256 periodToClaim = _snapshots[withdrawState.latestSnapshotPeriod]
            .nextSnapshotPeriod;
        uint256 lastSnapshotPeriod = _globalWithdrawState.latestSnapshotPeriod;

        if (periodToClaim > lastSnapshotPeriod || periodToClaim == 0) {
            return (0, 0);
        }

        // Loop through snapshots and accumulate shares and assets
        // Break once we reach the last snapshop for the pool or if all the eligible
        // shares have been converted, or if we reach the limit.
        uint256 snapshotShares;
        uint256 snapshotsClaimed;
        IPoolSnapshotState memory _periodSnapshot;
        for (snapshotsClaimed; snapshotsClaimed < limit; snapshotsClaimed++) {
            _periodSnapshot = _snapshots[periodToClaim];

            snapshotShares = withdrawState
                .eligibleShares
                .mul(_periodSnapshot.redeemableRateRay)
                .div(RAY);

            withdrawState.eligibleShares -= snapshotShares;
            sharesRedeemable += snapshotShares;
            assetsWithdrawable += snapshotShares
                .mul(_periodSnapshot.fxRateRay)
                .div(RAY);

            // Break if there are no more shares to claim.
            // Treat the lender as fully caught up.
            if (withdrawState.eligibleShares == 0) {
                withdrawState.latestSnapshotPeriod = lastSnapshotPeriod;
                break;
            }

            // "Advance" the withdraw state.
            withdrawState.latestSnapshotPeriod = periodToClaim;

            // If we just processed the latest snapshot, break
            if (periodToClaim == lastSnapshotPeriod) {
                break;
            }

            // Else, advance to the "next" snapshot
            periodToClaim = _periodSnapshot.nextSnapshotPeriod;
        }

        withdrawState.withdrawableAssets += assetsWithdrawable;
        withdrawState.redeemableShares += sharesRedeemable;
        _withdrawState[lender] = withdrawState;
        emit SnapshotsClaimed(
            lender,
            snapshotsClaimed,
            sharesRedeemable,
            assetsWithdrawable
        );
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
        IPoolWithdrawState memory state = _withdrawState[owner];

        // Calculate how many assets should be transferred
        assets = PoolLib.calculateAssetsFromShares(
            shares,
            state.withdrawableAssets,
            state.redeemableShares,
            false
        );

        _performWithdraw(owner, state, shares, assets);
    }

    /**
     * @inheritdoc IWithdrawController
     */
    function withdraw(address owner, uint256 assets)
        external
        onlyPool
        returns (uint256 shares)
    {
        IPoolWithdrawState memory state = _withdrawState[owner];

        // Calculate how many shares should be burned
        shares = PoolLib.calculateSharesFromAssets(
            assets,
            state.redeemableShares,
            state.withdrawableAssets,
            true
        );

        _performWithdraw(owner, state, shares, assets);
    }

    /**
     * @dev Perform the state update for a withdraw
     */
    function _performWithdraw(
        address owner,
        IPoolWithdrawState memory currentState,
        uint256 shares,
        uint256 assets
    ) internal {
        require(
            assets <= currentState.withdrawableAssets,
            "Pool: InsufficientBalance"
        );

        require(
            shares <= currentState.redeemableShares,
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
