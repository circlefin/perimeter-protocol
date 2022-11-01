// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPool.sol";
import "./interfaces/IPoolWithdrawManager.sol";
import "./libraries/PoolLib.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title WithdrawState
 */
contract PoolWithdrawManager is IPoolWithdrawManager {
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
     * @dev Modifier that checks that the caller is a pool lender
     */
    modifier onlyPool() {
        require(address(_pool) == msg.sender, "PoolWithdrawManager: Not Pool");
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
            _pool.poolActivatedAt(),
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
        state = PoolLib.progressWithdrawState(
            _withdrawState[owner],
            withdrawPeriod()
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
     * @inheritdoc IPoolWithdrawManager
     */
    function interestBearingBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _pool.balanceOf(owner) - maxRedeem(owner);
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function requestedBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _currentWithdrawState(owner).requestedShares;
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function totalRequestedBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().requestedShares;
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function eligibleBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _currentWithdrawState(owner).eligibleShares;
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function totalEligibleBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().eligibleShares;
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function totalRedeemableShares() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().redeemableShares;
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function totalWithdrawableAssets() external view returns (uint256 assets) {
        assets = _currentGlobalWithdrawState().withdrawableAssets;
    }

    /*//////////////////////////////////////////////////////////////
                            Max Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolWithdrawManager
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
     * @inheritdoc IPoolWithdrawManager
     */
    function maxRedeem(address owner) public view returns (uint256 maxShares) {
        maxShares = _currentWithdrawState(owner).redeemableShares;
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function maxWithdraw(address owner) external view returns (uint256 assets) {
        assets = _currentWithdrawState(owner).withdrawableAssets;
    }

    /*//////////////////////////////////////////////////////////////
                            Preview Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolWithdrawManager
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
     * @inheritdoc IPoolWithdrawManager
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
     * @inheritdoc IPoolWithdrawManager
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
     * @inheritdoc IPoolWithdrawManager
     */
    function previewWithdraw(address owner, uint256 assets)
        external
        view
        returns (uint256 shares)
    {
        shares = PoolLib.calculateConversion(
            assets,
            _currentWithdrawState(owner).redeemableShares,
            _currentWithdrawState(owner).withdrawableAssets,
            true
        );
    }

    /*//////////////////////////////////////////////////////////////
                            Request Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function performRequest(address owner, uint256 shares) external onlyPool {
        uint256 currentPeriod = withdrawPeriod();

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.calculateWithdrawStateForRequest(
            _currentWithdrawState(owner),
            currentPeriod,
            shares
        );

        // Add the address to the addresslist
        _withdrawAddresses.add(owner);

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
     * @inheritdoc IPoolWithdrawManager
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
     * @inheritdoc IPoolWithdrawManager
     */
    function performRequestCancellation(address owner, uint256 shares)
        external
        onlyPool
    {
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
     * @inheritdoc IPoolWithdrawManager
     */
    function crank() external onlyPool returns (uint256 redeemableShares) {
        // Calculate the amount available for withdrawal
        uint256 liquidAssets = _pool.liquidityPoolAssets();

        uint256 availableAssets = liquidAssets
            .mul(_pool.withdrawGate())
            .mul(PoolLib.RAY)
            .div(10_000)
            .div(PoolLib.RAY);

        uint256 availableShares = _pool.convertToShares(availableAssets);

        if (availableAssets <= 0 || availableShares <= 0) {
            // unable to redeem anything
            redeemableShares = 0;
            return 0;
        }

        IPoolWithdrawState memory globalState = _currentGlobalWithdrawState();

        // Determine the amount of shares that we will actually distribute.
        redeemableShares = Math.min(
            availableShares,
            globalState.eligibleShares
        );

        // Calculate the redeemable rate for each lender
        uint256 redeemableRateRay = redeemableShares.mul(PoolLib.RAY).div(
            globalState.eligibleShares
        );

        // iterate over every address that has made a withdraw request, and
        // determine how many shares they should be receiveing out of this
        // bucket of redeemableShares
        for (uint256 i; i < _withdrawAddresses.length(); i++) {
            address _addr = _withdrawAddresses.at(i);

            // crank the address's withdraw state
            IPoolWithdrawState memory state = _currentWithdrawState(_addr);

            // We're not eligible, move on to the next address
            if (state.eligibleShares == 0) {
                continue;
            }

            // calculate the shares able to be withdrawn
            uint256 shares = state.eligibleShares.mul(redeemableRateRay).div(
                PoolLib.RAY
            );

            _withdrawState[_addr] = PoolLib.updateWithdrawStateForWithdraw(
                state,
                _pool.convertToAssets(shares),
                shares
            );
        }

        // Update the global withdraw state
        // We update it after the for loop, otherwise the exchange rate
        // for each user gets distorted as the pool winds down and totalAvailableAssets
        // goes to zero.
        _globalWithdrawState = PoolLib.updateWithdrawStateForWithdraw(
            globalState,
            _pool.convertToAssets(redeemableShares),
            redeemableShares
        );
    }

    /*//////////////////////////////////////////////////////////////
                            Withdraw / Redeem
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function redeem(address owner, uint256 shares)
        external
        onlyPool
        returns (uint256 assets)
    {
        // Calculate how many assets should be transferred
        assets = PoolLib.calculateConversion(
            shares,
            _currentWithdrawState(owner).withdrawableAssets,
            _currentWithdrawState(owner).redeemableShares,
            false
        );

        _performWithdraw(owner, shares, assets);
    }

    /**
     * @inheritdoc IPoolWithdrawManager
     */
    function withdraw(address owner, uint256 assets)
        external
        onlyPool
        returns (uint256 shares)
    {
        // Calculate how many shares should be burned
        shares = PoolLib.calculateConversion(
            assets,
            _currentWithdrawState(owner).redeemableShares,
            _currentWithdrawState(owner).withdrawableAssets,
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
