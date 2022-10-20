// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IServiceConfiguration.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
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

    IPoolLifeCycleState private _poolLifeCycleState;
    address private _manager;
    IServiceConfiguration private _serviceConfiguration;
    IERC20 private _liquidityAsset;
    IPoolConfigurableSettings private _poolSettings;
    FeeVault private immutable _feeVault;
    FirstLossVault private _firstLossVault;
    IPoolAccountings private _accountings;

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
        require(
            _poolLifeCycleState == IPoolLifeCycleState.Active ||
                _poolLifeCycleState == IPoolLifeCycleState.Initialized,
            "Pool: invalid pool state"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atState(IPoolLifeCycleState state) {
        require(
            _poolLifeCycleState == state,
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
                _poolLifeCycleState,
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
        return
            PoolLib.executeFirstLossWithdraw(
                amount,
                receiver,
                address(_firstLossVault)
            );
    }

    /**
     * @dev Updates the pool capacity. Can only be called by the Pool Manager.
     */
    function updatePoolCapacity(uint256)
        external
        onlyManager
        returns (uint256)
    {}

    /**
     * @dev Updates the pool end date. Can only be called by the Pool Manager.
     */
    function updatePoolEndDate(uint256)
        external
        onlyManager
        returns (uint256)
    {}

    /**
     * @dev Called by the pool manager, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address addr)
        external
        onlyManager
        atState(IPoolLifeCycleState.Active)
    {
        require(
            PoolLib.isPoolLoan(
                addr,
                address(_serviceConfiguration),
                address(this)
            ),
            "Pool: invalid loan"
        );

        ILoan loan = ILoan(addr);

        _liquidityAsset.safeApprove(address(loan), loan.principal());
        loan.fund();
        _accountings.activeLoanPrincipals += loan.principal();
    }

    /**
     * @inheritdoc IPool
     */
    function defaultLoan(address loan)
        external
        onlyManager
        atState(IPoolLifeCycleState.Active)
    {
        require(loan != address(0), "Pool: 0 address");
        require(
            PoolLib.isPoolLoan(
                loan,
                address(_serviceConfiguration),
                address(this)
            ),
            "Pool: invalid loan"
        );

        PoolLib.executeDefault(
            asset(),
            address(_firstLossVault),
            loan,
            address(this),
            _accountings
        );
    }

    /**
     * @dev Returns the address of the underlying ERC20 token "locked" by the vault.
     */
    function asset() public view returns (address) {
        return address(_liquidityAsset);
    }

    /**
     * @dev Calculate the total amount of underlying assets held by the vault.
     */
    function totalAssets() public view returns (uint256) {
        return
            PoolLib.calculateTotalAssets(
                address(_liquidityAsset),
                address(this),
                _accountings.activeLoanPrincipals
            );
    }

    function claimFixedFee()
        external
        onlyManager
        atState(IPoolLifeCycleState.Active)
    {
        require(
            _poolSettings.fixedFeeDueDate < block.timestamp,
            "Pool: fixed fee not due"
        );
        // TODO: require the interval be more than 0?
        _poolSettings.fixedFeeDueDate +=
            _poolSettings.fixedFeeInterval *
            1 days;
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
        // TODO: Find the real available liquidity
        uint256 availableLiquidity = totalSupply();

        // How much is available to redeem for this period
        uint256 availableShares = availableLiquidity
            .mul(_poolSettings.withdrawGateBps)
            .mul(PoolLib.RAY)
            .div(10_000)
            .div(PoolLib.RAY);

        if (availableShares <= 0) {
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

        _globalWithdrawState = PoolLib.updateWithdrawStateForWithdraw(
            globalState,
            convertToAssets(redeemableShares),
            redeemableShares
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
     * @dev
     */

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
     * Emits a {RedeemRequested} event.
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
    function totalRedeemableBalance() external view returns (uint256 shares) {
        shares = _currentGlobalWithdrawState().redeemableShares;
    }

    /**
     * @dev Returns the number of `assets` that are available to be withdrawn
     * overall in the current block.
     */
    function totalWithdrawableBalance() external view returns (uint256 assets) {
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
     * @dev Performs a redeem request for the owner, including paying any fees.
     */
    function _requestWithdraw(
        address owner,
        uint256 assets,
        uint256 shares
    ) internal {
        require(maxRedeemRequest(owner) >= shares, "Pool: InsufficientBalance");

        uint256 currentPeriod = withdrawPeriod();
        uint256 nextPeriod = withdrawPeriod().add(1);
        uint256 feeShares = PoolLib.calculateRequestFee(
            shares,
            _poolSettings.requestFeeBps
        );

        // Pay the Fee
        _burn(owner, feeShares);

        // Update the requested amount from the user
        _withdrawState[owner] = PoolLib.caclulateWithdrawState(
            _withdrawState[owner],
            currentPeriod,
            nextPeriod,
            shares
        );

        // Add the address to the addresslist
        _withdrawAddresses.add(owner);

        // Update the global amount
        _globalWithdrawState = PoolLib.caclulateWithdrawState(
            _globalWithdrawState,
            currentPeriod,
            nextPeriod,
            shares
        );

        emit WithdrawRequested(msg.sender, assets, shares);
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
                    _poolSettings.fixedFeeDueDate =
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
     * @dev Calculates the amount of shares that would be exchanged by the vault for the amount of assets provided.
     */
    function convertToShares(uint256 assets)
        public
        view
        override
        returns (uint256)
    {
        return
            PoolLib.calculateAssetsToShares(
                assets,
                totalSupply(),
                totalAssets()
            );
    }

    /**
     * @dev Calculates the amount of assets that would be exchanged by the vault for the amount of shares provided.
     */
    function convertToAssets(uint256 shares)
        public
        view
        override
        returns (uint256)
    {
        return
            PoolLib.calculateSharesToAssets(
                shares,
                totalSupply(),
                totalAssets()
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
                _poolLifeCycleState,
                _poolSettings.maxCapacity,
                totalAssets()
            );
    }

    /**
     * @dev Allows users to simulate the effects of their deposit at the current block.
     */
    function previewDeposit(uint256 assets)
        public
        view
        override
        returns (uint256)
    {
        return convertToShares(assets);
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
        return this.previewDeposit(this.maxDeposit(receiver));
    }

    /**
     * @dev Allows users to simulate the effects of their mint at the current block.
     */
    function previewMint(uint256 shares)
        public
        view
        override
        returns (uint256 assets)
    {
        return this.convertToAssets(shares);
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
     */
    function previewWithdraw(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        shares = PoolLib.calculateAssetsToShares(
            assets,
            _withdrawState[msg.sender].redeemableShares,
            _withdrawState[msg.sender].withdrawableAssets
        );
    }

    /**
     * @dev Burns shares from owner and send exactly assets token from the vault to receiver.
     * Emits a {Withdraw} event.
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
        shares = PoolLib.calculateAssetsToShares(
            assets,
            _withdrawState[owner].redeemableShares,
            _withdrawState[owner].withdrawableAssets
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
     */
    function previewRedeem(uint256 shares)
        external
        view
        override
        returns (uint256 assets)
    {
        assets = PoolLib.calculateSharesToAssets(
            shares,
            _withdrawState[msg.sender].withdrawableAssets,
            _withdrawState[msg.sender].redeemableShares
        );
    }

    /**
     * @dev Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.
     * Emits a {Withdraw} event.
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
        assets = PoolLib.calculateSharesToAssets(
            shares,
            _withdrawState[owner].withdrawableAssets,
            _withdrawState[owner].redeemableShares
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
