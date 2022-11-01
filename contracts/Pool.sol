// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IServiceConfiguration.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "./libraries/PoolLib.sol";
import "./FeeVault.sol";
import "./FirstLossVault.sol";

/**
 * @title Pool
 *
 * Mostly empty Pool contract.
 */
contract Pool is IPool, ERC20 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    address private _manager;
    IServiceConfiguration private _serviceConfiguration;
    IERC20 private _liquidityAsset;
    FeeVault private _feeVault;
    FirstLossVault private _firstLossVault;
    IPoolConfigurableSettings private _poolSettings;
    IPoolAccountings private _accountings;
    IPoolLifeCycleState private _poolLifeCycleState;

    /**
     * @dev list of all active loan addresses for this Pool. Active loans have been
     * drawn down, and the payment schedule activated.
     */
    EnumerableSet.AddressSet private _fundedLoans;

    /**
     * @dev a timestamp of when the pool was first put into the Active state
     */
    uint256 public poolActivatedAt;

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
     * @dev Modifier that checks that the caller is the pool's manager.
     */
    modifier onlyManager() {
        require(
            _manager != address(0) && msg.sender == _manager,
            "Pool: caller is not manager"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the caller is a pool lender
     */
    modifier onlyLender() {
        require(balanceOf(msg.sender) > 0, "Pool: caller is not a lender");
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atInitializedOrActiveState() {
        IPoolLifeCycleState _lifecycle = lifeCycleState();
        require(
            _lifecycle == IPoolLifeCycleState.Active ||
                _lifecycle == IPoolLifeCycleState.Initialized,
            "Pool: invalid pool state"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atState(IPoolLifeCycleState state) {
        require(
            lifeCycleState() == state,
            "Pool: FunctionInvalidAtThisLifeCycleState"
        );
        _;
    }

    /**
     * @dev Modifier to check that the pool has ever been activated
     */
    modifier onlyActivatedPool() {
        require(poolActivatedAt > 0, "Pool: PoolNotActive");
        _;
    }

    /**
     * @dev Modifier to check that an addres is a Valyria loan associated
     * with this pool.
     */
    modifier isPoolLoan(address loan) {
        require(
            PoolLib.isPoolLoan(
                loan,
                address(_serviceConfiguration),
                address(this)
            ),
            "Pool: invalid loan"
        );
        _;
    }

    /**
     * @dev Constructor for Pool
     * @param liquidityAsset asset held by the poo
     * @param poolManager manager of the pool
     * @param poolSettings configurable settings for the pool
     * @param serviceConfiguration address of global service configuration
     * @param tokenName Name used for issued pool tokens
     * @param tokenSymbol Symbol used for issued pool tokens
     */
    constructor(
        address liquidityAsset,
        address poolManager,
        address serviceConfiguration,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {
        _liquidityAsset = IERC20(liquidityAsset);
        _poolSettings = poolSettings;
        _manager = poolManager;
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
        _firstLossVault = new FirstLossVault(address(this), liquidityAsset);
        _feeVault = new FeeVault(address(this));
        _setPoolLifeCycleState(IPoolLifeCycleState.Initialized);

        // Allow the contract to move infinite amount of vault liquidity assets
        _liquidityAsset.safeApprove(address(this), type(uint256).max);
    }

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function lifeCycleState() public view returns (IPoolLifeCycleState) {
        if (block.timestamp >= _poolSettings.endDate) {
            return IPoolLifeCycleState.Closed;
        }

        return _poolLifeCycleState;
    }

    /**
     * @dev The current configurable pool settings.
     */
    function settings()
        external
        view
        returns (IPoolConfigurableSettings memory poolSettings)
    {
        return _poolSettings;
    }

    /**
     * @dev Allow the current pool manager to update the pool fees
     * before the pool has been activated.
     */
    function setRequestFee(uint256 feeBps)
        external
        onlyManager
        atState(IPoolLifeCycleState.Initialized)
    {
        _poolSettings.requestFeeBps = feeBps;
    }

    /**
     * @dev Allow the current pool manager to update the withdraw gate at any
     * time if the pool is Initialized or Active
     */
    function setWithdrawGate(uint256 _withdrawGateBps)
        external
        onlyManager
        atInitializedOrActiveState
    {
        _poolSettings.withdrawGateBps = _withdrawGateBps;
    }

    /**
     * @dev Returns the current withdraw gate in bps. If the pool is closed, this
     * is set to 10_000 (100%)
     */
    function withdrawGate() public view returns (uint256) {
        if (lifeCycleState() == IPoolLifeCycleState.Closed) {
            return 10_000;
        }

        return _poolSettings.withdrawGateBps;
    }

    /**
     * @dev The manager of the pool
     */
    function manager() external view override returns (address) {
        return _manager;
    }

    /**
     * @dev The current amount of first loss available to the pool
     */
    function firstLoss() external view override returns (uint256) {
        return _liquidityAsset.balanceOf(address(_firstLossVault));
    }

    /**
     * @dev The address of the first loss vault
     */
    function firstLossVault() external view override returns (address) {
        return address(_firstLossVault);
    }

    /**
     * @dev The address of the fee vault.
     */
    function feeVault() external view override returns (address) {
        return address(_feeVault);
    }

    /**
     * @dev The pool accounting variables;
     */
    function accountings() external view returns (IPoolAccountings memory) {
        return _accountings;
    }

    /**
     * @dev The fee
     */
    function poolFeePercentOfInterest() external view returns (uint256) {
        return _poolSettings.poolFeePercentOfInterest;
    }

    /**
     * @dev Supplies first-loss to the pool. Can only be called by the Pool Manager.
     */
    function depositFirstLoss(uint256 amount, address spender)
        external
        onlyManager
        atInitializedOrActiveState
    {
        IPoolLifeCycleState poolLifeCycleState = PoolLib
            .executeFirstLossDeposit(
                address(_liquidityAsset),
                spender,
                amount,
                address(_firstLossVault),
                lifeCycleState(),
                _poolSettings.firstLossInitialMinimum
            );

        _setPoolLifeCycleState(poolLifeCycleState);
    }

    /**
     * @dev inheritdoc IPool
     */
    function withdrawFirstLoss(uint256 amount, address receiver)
        external
        onlyManager
        atState(IPoolLifeCycleState.Closed)
        returns (uint256)
    {
        require(_fundedLoans.length() == 0, "Pool: loans still active");
        return
            PoolLib.executeFirstLossWithdraw(
                amount,
                receiver,
                address(_firstLossVault)
            );
    }

    /**
     * @inheritdoc IPool
     */
    function updatePoolCapacity(uint256 newCapacity) external onlyManager {
        require(newCapacity >= totalAssets(), "Pool: invalid capacity");
        _poolSettings.maxCapacity = newCapacity;
        emit PoolSettingsUpdated();
    }

    /**
     * @inheritdoc IPool
     */
    function updatePoolEndDate(uint256 endDate) external onlyManager {
        PoolLib.executeUpdateEndDate(endDate, _poolSettings);
    }

    /**
     * @dev Called by the pool manager, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address addr)
        external
        onlyManager
        atState(IPoolLifeCycleState.Active)
        isPoolLoan(addr)
    {
        ILoan loan = ILoan(addr);
        _liquidityAsset.safeApprove(address(loan), loan.principal());
        loan.fund();
        _accountings.outstandingLoanPrincipals += loan.principal();
        _fundedLoans.add(addr);
    }

    /**
     * @inheritdoc IPool
     */
    function notifyLoanPrincipalReturned() external {
        require(_fundedLoans.remove(msg.sender), "Pool: not active loan");
        _accountings.outstandingLoanPrincipals -= ILoan(msg.sender).principal();
    }

    /**
     * @inheritdoc IPool
     */
    function defaultLoan(address loan) external onlyManager {
        require(loan != address(0), "Pool: 0 address");
        IPoolLifeCycleState state = lifeCycleState();
        require(
            state == IPoolLifeCycleState.Active ||
                state == IPoolLifeCycleState.Closed,
            "Pool: FunctionInvalidAtThisLifeCycleState"
        );

        PoolLib.executeDefault(
            asset(),
            address(_firstLossVault),
            loan,
            address(this),
            _accountings,
            _fundedLoans
        );
    }

    /**
     * @dev Calculate the total amount of underlying assets held by the vault,
     * excluding any assets due for withdrawal.
     */
    function totalAvailableAssets() public view returns (uint256 assets) {
        assets = PoolLib.calculateTotalAvailableAssets(
            address(_liquidityAsset),
            address(this),
            _accountings.outstandingLoanPrincipals,
            totalWithdrawableAssets()
        );
    }

    /**
     * @dev The total available supply that is not marked for withdrawal
     */
    function totalAvailableSupply() public view returns (uint256 shares) {
        shares = PoolLib.calculateTotalAvailableShares(
            address(this),
            totalRedeemableShares()
        );
    }

    /**
     * @dev The sum of all assets available in the liquidity pool, excluding
     * any assets that are marked for withdrawal.
     */
    function liquidityPoolAssets() public view returns (uint256 assets) {
        assets = PoolLib.calculateTotalAvailableAssets(
            address(_liquidityAsset),
            address(this),
            0, // do not include any loan principles
            totalWithdrawableAssets()
        );
    }

    function claimFixedFee() external onlyManager {
        require(
            _accountings.fixedFeeDueDate < block.timestamp,
            "Pool: fixed fee not due"
        );
        _accountings.fixedFeeDueDate += _poolSettings.fixedFeeInterval * 1 days;
        IERC20(_liquidityAsset).safeTransfer(
            msg.sender,
            _poolSettings.fixedFee
        );
    }

    /*//////////////////////////////////////////////////////////////
                    Crank
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Crank the protocol. Issues withdrawals
     */
    function crank() external returns (uint256 redeemableShares) {
        // Calculate the amount available for withdrawal
        uint256 liquidAssets = liquidityPoolAssets();

        uint256 availableAssets = liquidAssets
            .mul(_poolSettings.withdrawGateBps)
            .mul(PoolLib.RAY)
            .div(10_000)
            .div(PoolLib.RAY);

        uint256 availableShares = convertToShares(availableAssets);

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
                convertToAssets(shares),
                shares
            );
        }

        // Update the global withdraw state
        // We update it after the for loop, otherwise the exchange rate
        // for each user gets distorted as the pool winds down and totalAvailableAssets
        // goes to zero.
        _globalWithdrawState = PoolLib.updateWithdrawStateForWithdraw(
            globalState,
            convertToAssets(redeemableShares),
            redeemableShares
        );
    }

    /*//////////////////////////////////////////////////////////////
                    Withdraw/Redeem Request Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev The current withdraw period. Funds marked with this period (or
     * earlier), are eligible to be considered for redemption/widrawal.
     */
    function withdrawPeriod() public view returns (uint256 period) {
        period = PoolLib.calculateCurrentWithdrawPeriod(
            block.timestamp,
            poolActivatedAt,
            _poolSettings.withdrawRequestPeriodDuration
        );
    }

    /**
     * @dev Returns the redeem fee for a given withdrawal amount at the current block.
     * The fee is the number of shares that will be charged.
     */
    function requestFee(uint256 sharesOrAssets)
        public
        view
        returns (uint256 feeShares)
    {
        feeShares = PoolLib.calculateRequestFee(
            sharesOrAssets,
            _poolSettings.requestFeeBps
        );
    }

    /**
     * @dev Returns the maximum number of `shares` that can be
     * cancelled from being requested for a redemption.
     *
     * Note: This is equivalent of EIP-4626 `maxRedeem`
     */
    function maxRequestCancellation(address owner)
        public
        view
        returns (uint256 maxShares)
    {
        maxShares = PoolLib.calculateMaxCancellation(
            _withdrawState[owner],
            _poolSettings.requestCancellationFeeBps
        );
    }

    /**
     * @dev Returns the maximum number of `shares` that can be
     * requested to be redeemed from the owner balance with a single
     * `requestRedeem` call in the current block.
     *
     * Note: This is equivalent of EIP-4626 `maxRedeem`
     */
    function maxRedeemRequest(address owner)
        public
        view
        returns (uint256 maxShares)
    {
        maxShares = PoolLib.calculateMaxRedeemRequest(
            _withdrawState[owner],
            balanceOf(owner),
            _poolSettings.requestFeeBps
        );
    }

    /**
     * @dev Simulate the effects of a redeem request at the current block.
     * Returns the amount of underlying assets that would be requested if this
     * entire redeem request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewRedeem`
     */
    function previewRedeemRequest(uint256 shares)
        external
        view
        returns (uint256 assets)
    {
        uint256 shareFees = PoolLib.calculateRequestFee(
            shares,
            _poolSettings.requestFeeBps
        );

        assets = convertToAssets(shares - shareFees);
    }

    /**
     * @dev Requests redeeming a specific number of `shares` from owner and
     * returns an estimated amount of underlying that will be received if this
     * were immeidately executed.
     *
     * Emits a {WithdrawRequested} event.
     */
    function requestRedeem(uint256 shares)
        external
        onlyActivatedPool
        onlyLender
        returns (uint256 assets)
    {
        assets = convertToAssets(shares);
        _requestWithdraw(msg.sender, assets, shares);
    }

    /**
     * @dev Cancels a redeem request for a specific number of `shares` from
     * owner and returns an estimated amnount of underlying that equates to
     * this number of shares.
     *
     * Emits a {WithdrawRequestCancelled} event.
     */
    function cancelRedeemRequest(uint256 shares)
        external
        onlyActivatedPool
        onlyLender
        returns (uint256 assets)
    {
        assets = convertToAssets(shares);
        _cancelWithdraw(msg.sender, assets, shares);
    }

    /**
     * @dev Returns the maximum amount of underlying `assets` that can be
     * requested to be withdrawn from the owner balance with a single
     * `requestWithdraw` call in the current block.
     *
     * Note: This is equivalent of EIP-4626 `maxWithdraw`
     */
    function maxWithdrawRequest(address owner)
        public
        view
        returns (uint256 maxAssets)
    {
        maxAssets = convertToAssets(maxRedeemRequest(owner));
    }

    /**
     * @dev Simulate the effects of a withdrawal request at the current block.
     * Returns the amount of `shares` that would be burned if this entire
     * withdrawal request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewWithdraw`
     */
    function previewWithdrawRequest(uint256 assets)
        external
        view
        returns (uint256 shares)
    {
        uint256 assetFees = PoolLib.calculateRequestFee(
            assets,
            _poolSettings.requestFeeBps
        );

        shares = convertToShares(assets + assetFees);
    }

    /**
     * @dev Requests withdrawing a specific value of `assets` from owner and
     * returns an estimated number of shares that will be removed if this
     * were immeidately executed.
     *
     * Emits a {WithdrawRequested} event.
     */
    function requestWithdraw(uint256 assets)
        external
        onlyActivatedPool
        onlyLender
        returns (uint256 shares)
    {
        shares = convertToShares(assets);
        _requestWithdraw(msg.sender, assets, shares);
    }

    /**
     * @dev Cancels a withdraw request for a specific values of `assets` from
     * owner and returns an estimated number of shares that equates to
     * this number of assets.
     *
     * Emits a {WithdrawRequestCancelled} event.
     */
    function cancelWithdrawRequest(uint256 assets)
        external
        onlyActivatedPool
        onlyLender
        returns (uint256 shares)
    {
        shares = convertToShares(assets);
        _cancelWithdraw(msg.sender, assets, shares);
    }

    /**
     * @dev Returns the amount of shares that should be considered interest
     * bearing for a given owner.  This number is their balance, minus their
     * "redeemable" shares.
     */
    function interestBearingBalanceOf(address owner)
        public
        view
        returns (uint256 shares)
    {
        shares = balanceOf(owner) - maxRedeem(owner);
    }

    /**
     * @dev Returns the number of shares that have been requested to be redeemed
     * by the owner as of the current block.
     */
    function requestedBalanceOf(address owner)
        public
        view
        returns (uint256 shares)
    {
        shares = _currentWithdrawState(owner).requestedShares;
    }

    /**
     * @dev Returns the number of shares that are available to be redeemed by
     * the owner in the current block.
     */
    function totalRequestedBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().requestedShares;
    }

    /**
     * @dev Returns the number of shares owned by an address that are "vested"
     * enough to be considered for redeeming during the next withdraw period.
     */
    function eligibleBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _currentWithdrawState(owner).eligibleShares;
    }

    /**
     * @dev Returns the number of shares overall that are "vested" enough to be
     * considered for redeeming during the next withdraw period.
     */
    function totalEligibleBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().eligibleShares;
    }

    /**
     * @dev Returns the number of shares that are available to be redeemed
     * overall in the current block.
     */
    function totalRedeemableShares() public view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().redeemableShares;
    }

    /**
     * @dev Returns the number of `assets` that are available to be withdrawn
     * overall in the current block.
     */
    function totalWithdrawableAssets() public view returns (uint256 assets) {
        assets = _currentGlobalWithdrawState().withdrawableAssets;
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

    /**
     * @dev Performs a withdraw request for the owner, including paying any fees.
     */
    function _requestWithdraw(
        address owner,
        uint256 assets,
        uint256 shares
    ) internal {
        require(maxRedeemRequest(owner) >= shares, "Pool: InsufficientBalance");

        uint256 currentPeriod = withdrawPeriod();
        uint256 feeShares = PoolLib.calculateRequestFee(
            shares,
            _poolSettings.requestFeeBps
        );

        // Pay the Fee
        _burn(owner, feeShares);

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.calculateWithdrawStateForRequest(
            _withdrawState[owner],
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

        emit WithdrawRequested(msg.sender, assets, shares);
    }

    /**
     * @dev Cancels a withdraw request for the owner, including paying any fees.
     * A cancellation can only occur before the
     */
    function _cancelWithdraw(
        address owner,
        uint256 assets,
        uint256 shares
    ) internal {
        // TODO: If we move to a lighter crank, we must run it here before this method continues
        require(
            maxRequestCancellation(owner) >= shares,
            "Pool: InsufficientBalance"
        );

        uint256 currentPeriod = withdrawPeriod();
        uint256 feeShares = PoolLib.calculateRequestFee(
            shares,
            _poolSettings.requestFeeBps
        );

        // Pay the Fee
        _burn(owner, feeShares);

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.calculateWithdrawStateForCancellation(
            _withdrawState[owner],
            currentPeriod,
            shares
        );

        // Add the address to the addresslist
        _withdrawAddresses.add(owner);

        // Update the global amount
        _globalWithdrawState = PoolLib.calculateWithdrawStateForCancellation(
            _globalWithdrawState,
            currentPeriod,
            shares
        );

        emit WithdrawRequestCancelled(msg.sender, assets, shares);
    }

    /**
     * @dev Set the pool lifecycle state. If the state changes, this method
     * will also update the poolActivatedAt variable
     */
    function _setPoolLifeCycleState(IPoolLifeCycleState state) internal {
        if (_poolLifeCycleState != state) {
            if (state == IPoolLifeCycleState.Active && poolActivatedAt == 0) {
                poolActivatedAt = block.timestamp;

                if (_poolSettings.fixedFee != 0) {
                    _accountings.fixedFeeDueDate =
                        block.timestamp +
                        _poolSettings.fixedFeeInterval *
                        1 days;
                }
            }

            _poolLifeCycleState = state;
            emit LifeCycleStateTransition(state);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        ERC-4626 Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IERC4626
     */
    function asset() public view returns (address) {
        return address(_liquidityAsset);
    }

    /**
     * @inheritdoc IERC4626
     */
    function totalAssets() public view returns (uint256) {
        return
            PoolLib.calculateTotalAssets(
                address(_liquidityAsset),
                address(this),
                _accountings.outstandingLoanPrincipals
            );
    }

    /**
     * @dev Calculates the amount of shares that would be exchanged by the vault for the amount of assets provided.
     * Rounds DOWN per EIP4626.
     */
    function convertToShares(uint256 assets)
        public
        view
        override
        returns (uint256)
    {
        return
            PoolLib.calculateConversion(
                assets,
                totalAvailableSupply(),
                totalAvailableAssets(),
                false
            );
    }

    /**
     * @dev Calculates the amount of assets that would be exchanged by the vault for the amount of shares provided.
     * Rounds DOWN per EIP4626.
     */
    function convertToAssets(uint256 shares)
        public
        view
        override
        returns (uint256)
    {
        return
            PoolLib.calculateConversion(
                shares,
                totalAvailableAssets(),
                totalAvailableSupply(),
                false
            );
    }

    /**
     * @dev Calculates the maximum amount of underlying assets that can be deposited in a single deposit call by the receiver.
     */
    function maxDeposit(address)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return
            PoolLib.calculateMaxDeposit(
                lifeCycleState(),
                _poolSettings.maxCapacity,
                totalAvailableAssets()
            );
    }

    /**
     * @dev Allows users to simulate the effects of their deposit at the current block.
     * Rounds DOWN per EIP4626
     */
    function previewDeposit(uint256 assets)
        public
        view
        override
        returns (uint256)
    {
        return
            PoolLib.calculateConversion(
                assets,
                totalSupply(),
                totalAvailableAssets() +
                    PoolLib.calculateExpectedInterest(_fundedLoans),
                false
            );
    }

    /**
     * @dev Deposits assets of underlying tokens into the vault and grants ownership of shares to receiver.
     * Emits a {Deposit} event.
     */
    function deposit(uint256 assets, address receiver)
        public
        virtual
        override
        atState(IPoolLifeCycleState.Active)
        returns (uint256 shares)
    {
        shares = PoolLib.executeDeposit(
            asset(),
            address(this),
            receiver,
            assets,
            previewDeposit(assets),
            maxDeposit(receiver),
            _mint
        );
    }

    /**
     * @dev Returns the maximum amount of shares that can be minted in a single mint call by the receiver.
     */
    function maxMint(address receiver)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return previewDeposit(maxDeposit(receiver));
    }

    /**
     * @dev Allows users to simulate the effects of their mint at the current block.
     * Rounds UP per EIP4626, to determine the number of assets to be provided for shares.
     */
    function previewMint(uint256 shares)
        public
        view
        override
        returns (uint256 assets)
    {
        return
            PoolLib.calculateConversion(
                shares,
                totalAvailableAssets() +
                    PoolLib.calculateExpectedInterest(_fundedLoans),
                totalAvailableSupply(),
                true
            );
    }

    /**
     * @dev Mints exactly shares vault shares to receiver by depositing assets of underlying tokens.
     * Emits a {Deposit} event.
     */
    function mint(uint256 shares, address receiver)
        public
        virtual
        override
        atState(IPoolLifeCycleState.Active)
        returns (uint256 assets)
    {
        assets = previewMint(shares);
        PoolLib.executeDeposit(
            asset(),
            address(this),
            receiver,
            assets,
            previewDeposit(assets),
            maxDeposit(receiver),
            _mint
        );
    }

    /**
     * @dev Returns the maximum amount of underlying assets that can be withdrawn from the owner balance with a single withdraw call.
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        return _withdrawState[owner].withdrawableAssets;
    }

    /**
     * @dev Simulate the effects of their withdrawal at the current block.
     * Per EIP4626, should round UP on the number of shares required for assets.
     */
    function previewWithdraw(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        shares = PoolLib.calculateConversion(
            assets,
            _withdrawState[msg.sender].redeemableShares,
            _withdrawState[msg.sender].withdrawableAssets,
            true
        );
    }

    /**
     * @dev Burns shares from owner and send exactly assets token from the vault to receiver.
     * Emits a {Withdraw} event.
     * Should round UP for EIP4626.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external virtual returns (uint256 shares) {
        require(receiver == owner, "Pool: Withdrawal to unrelated address");
        require(receiver == msg.sender, "Pool: Must transfer to msg.sender");
        require(assets > 0, "Pool: 0 withdraw not allowed");
        require(maxWithdraw(owner) >= assets, "Pool: InsufficientBalance");

        // Calculate how many shares should be burned
        shares = PoolLib.calculateConversion(
            assets,
            _withdrawState[owner].redeemableShares,
            _withdrawState[owner].withdrawableAssets,
            true
        );

        // Update the withdraw state, transfer assets, and burn the shares
        _withdraw(assets, shares, owner, receiver);
    }

    /**
     * @dev The maximum amount of shares that can be redeemed from the owner balance through a redeem call.
     */
    function maxRedeem(address owner)
        public
        view
        override
        returns (uint256 maxShares)
    {
        maxShares = _currentWithdrawState(owner).redeemableShares;
    }

    /**
     * @dev Simulates the effects of their redeemption at the current block.
     * Per EIP4626, should round DOWN.
     */
    function previewRedeem(uint256 shares)
        external
        view
        override
        returns (uint256 assets)
    {
        assets = PoolLib.calculateConversion(
            shares,
            _withdrawState[msg.sender].withdrawableAssets,
            _withdrawState[msg.sender].redeemableShares,
            false
        );
    }

    /**
     * @dev Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.
     * Emits a {Withdraw} event.
     * Per EIP4626, should round DOWN.
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external virtual returns (uint256 assets) {
        require(receiver == owner, "Pool: Withdrawal to unrelated address");
        require(receiver == msg.sender, "Pool: Must transfer to msg.sender");
        require(shares > 0, "Pool: 0 redeem not allowed");
        require(maxRedeem(owner) >= shares, "Pool: InsufficientBalance");

        // Calculate how many assets should be transferred
        assets = PoolLib.calculateConversion(
            shares,
            _withdrawState[owner].withdrawableAssets,
            _withdrawState[owner].redeemableShares,
            false
        );

        // Update the withdraw state, transfer assets, and burn the shares
        _withdraw(assets, shares, receiver, owner);
    }

    /**
     * @dev Redeem a number of shares for a given number of assets. This method
     * will transfer `assets` from the vault to the `receiver`, and burn `shares`
     * from `owner`.
     */
    function _withdraw(
        uint256 assets,
        uint256 shares,
        address owner,
        address receiver
    ) internal {
        require(
            assets <= _withdrawState[owner].withdrawableAssets,
            "Pool: InsufficientBalance"
        );

        require(
            shares <= _withdrawState[owner].redeemableShares,
            "Pool: InsufficientBalance"
        );

        // update the withdrawstate to account for these shares being
        // removed from "withdrawable"
        _withdrawState[owner].redeemableShares = _withdrawState[owner]
            .redeemableShares
            .sub(shares);
        _withdrawState[owner].withdrawableAssets = _withdrawState[owner]
            .withdrawableAssets
            .sub(assets);

        // update global state
        _globalWithdrawState.redeemableShares -= shares;
        _globalWithdrawState.withdrawableAssets -= assets;

        // Transfer assets
        _liquidityAsset.safeTransferFrom(address(this), receiver, assets);

        // Burn the shares
        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                            ERC-20 Overrides
    //////////////////////////////////////////////////////////////*/

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        require(
            to == address(0) || from == address(0),
            "Pool: transfers disabled"
        );
    }
}
