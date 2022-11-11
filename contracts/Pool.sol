// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./controllers/interfaces/IWithdrawController.sol";
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
 */
contract Pool is IPool, ERC20 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    address private _admin;
    address private immutable _factory;
    IServiceConfiguration private _serviceConfiguration;
    IERC20 private _liquidityAsset;
    FeeVault private _feeVault;
    FirstLossVault private _firstLossVault;
    IPoolConfigurableSettings private _poolSettings;
    IPoolAccountings private _accountings;
    IPoolLifeCycleState private _poolLifeCycleState;
    IWithdrawController private _withdrawController;

    /**
     * @dev list of all active loan addresses for this Pool. Active loans have been
     * drawn down, and the payment schedule activated.
     */
    EnumerableSet.AddressSet private _fundedLoans;

    /**
     * @inheritdoc IPool
     */
    uint256 public poolActivatedAt;

    /**
     * @dev Modifier that checks that the caller is the pool's factory.
     */
    modifier onlyFactory() {
        require(
            _factory != address(0) && msg.sender == _factory,
            "Pool: caller is not factory"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the caller is the pool's admin.
     */
    modifier onlyAdmin() {
        require(
            _admin != address(0) && msg.sender == _admin,
            "Pool: caller is not admin"
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
     * @dev Modifier to check that the pool has ever been activated
     */
    modifier onlyActivatedPool() {
        require(poolActivatedAt > 0, "Pool: PoolNotActive");
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
     * @dev Modifier to check that an addres is a Perimeter loan associated
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
     * @param poolAdmin admin of the pool
     * @param poolSettings configurable settings for the pool
     * @param serviceConfiguration address of global service configuration
     * @param tokenName Name used for issued pool tokens
     * @param tokenSymbol Symbol used for issued pool tokens
     */
    constructor(
        address factory,
        address liquidityAsset,
        address poolAdmin,
        address serviceConfiguration,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {
        _factory = factory;
        _liquidityAsset = IERC20(liquidityAsset);
        _poolSettings = poolSettings;
        _admin = poolAdmin;
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
        _firstLossVault = new FirstLossVault(address(this), liquidityAsset);
        _feeVault = new FeeVault(address(this));
        _setPoolLifeCycleState(IPoolLifeCycleState.Initialized);

        // Allow the contract to move infinite amount of vault liquidity assets
        _liquidityAsset.safeApprove(address(this), type(uint256).max);
    }

    /**
     * @dev Returns the pool's withdraw controller
     */
    function withdrawController() public view returns (IWithdrawController) {
        return _withdrawController;
    }

    function setWithdrawController(address addr) public onlyFactory {
        require(
            address(_withdrawController) == address(0),
            "Pool: WithdrawControllerAlreadySet"
        );

        _withdrawController = IWithdrawController(addr);
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
     * @dev Allow the current pool admin to update the pool fees
     * before the pool has been activated.
     */
    function setRequestFee(uint256 feeBps)
        external
        onlyAdmin
        atState(IPoolLifeCycleState.Initialized)
    {
        _poolSettings.requestFeeBps = feeBps;
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
     * @dev Allow the current pool admin to update the withdraw gate at any
     * time if the pool is Initialized or Active
     */
    function setWithdrawGate(uint256 _withdrawGateBps)
        external
        onlyAdmin
        atInitializedOrActiveState
    {
        _poolSettings.withdrawGateBps = _withdrawGateBps;
    }

    /**
     * @inheritdoc IPool
     */
    function withdrawGate() public view returns (uint256) {
        if (lifeCycleState() == IPoolLifeCycleState.Closed) {
            return 10_000;
        }

        return _poolSettings.withdrawGateBps;
    }

    /**
     * @dev The admin of the pool
     */
    function admin() external view override returns (address) {
        return _admin;
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
     * @dev Supplies first-loss to the pool. Can only be called by the Pool Admin.
     */
    function depositFirstLoss(uint256 amount, address spender)
        external
        onlyAdmin
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
        onlyAdmin
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
    function updatePoolCapacity(uint256 newCapacity) external onlyAdmin {
        require(newCapacity >= totalAssets(), "Pool: invalid capacity");
        _poolSettings.maxCapacity = newCapacity;
        emit PoolSettingsUpdated();
    }

    /**
     * @inheritdoc IPool
     */
    function updatePoolEndDate(uint256 endDate) external onlyAdmin {
        PoolLib.executeUpdateEndDate(endDate, _poolSettings);
    }

    /**
     * @dev Called by the pool admin, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address addr)
        external
        onlyAdmin
        atState(IPoolLifeCycleState.Active)
        isPoolLoan(addr)
    {
        ILoan loan = ILoan(addr);

        uint256 principal = loan.principal();
        require(totalAvailableAssets() >= principal, "Pool: not enough assets");

        _liquidityAsset.safeApprove(address(loan), principal);
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
    function defaultLoan(address loan) external onlyAdmin {
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
            _withdrawController.totalWithdrawableAssets()
        );
    }

    /**
     * @dev The total available supply that is not marked for withdrawal
     */
    function totalAvailableSupply() public view returns (uint256 shares) {
        shares = PoolLib.calculateTotalAvailableShares(
            address(this),
            _withdrawController.totalRedeemableShares()
        );
    }

    /**
     * @inheritdoc IPool
     */
    function liquidityPoolAssets() public view returns (uint256 assets) {
        assets = PoolLib.calculateTotalAvailableAssets(
            address(_liquidityAsset),
            address(this),
            0, // do not include any loan principles
            _withdrawController.totalWithdrawableAssets()
        );
    }

    function claimFixedFee() external onlyAdmin {
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
                Withdraw Controller Proxy Methods
    //////////////////////////////////////////////////////////////*/

    function withdrawPeriod() public view returns (uint256 period) {
        period = _withdrawController.withdrawPeriod();
    }

    function interestBearingBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _withdrawController.interestBearingBalanceOf(owner);
    }

    function requestedBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _withdrawController.requestedBalanceOf(owner);
    }

    function totalRequestedBalance() external view returns (uint256 shares) {
        shares = _withdrawController.totalRequestedBalance();
    }

    function eligibleBalanceOf(address owner)
        external
        view
        returns (uint256 shares)
    {
        shares = _withdrawController.eligibleBalanceOf(owner);
    }

    function totalEligibleBalance() external view returns (uint256 shares) {
        shares = _withdrawController.totalEligibleBalance();
    }

    function totalWithdrawableAssets() external view returns (uint256 assets) {
        assets = _withdrawController.totalWithdrawableAssets();
    }

    function totalRedeemableShares() external view returns (uint256 shares) {
        shares = _withdrawController.totalRedeemableShares();
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
        maxShares = _withdrawController.maxRedeemRequest(owner);
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
        assets = _withdrawController.previewRedeemRequest(shares);
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
        shares = _withdrawController.previewWithdrawRequest(assets);
    }

    /**
     * @dev Request a redemption of a number of shares from the pool
     */
    function requestRedeem(uint256 shares)
        external
        onlyActivatedPool
        onlyLender
        returns (uint256 assets)
    {
        assets = convertToAssets(shares);
        _performRedeemRequest(msg.sender, shares, assets);
    }

    /**
     * @dev Request a Withdraw of a number of assets from the pool
     */
    function requestWithdraw(uint256 assets)
        external
        onlyActivatedPool
        onlyLender
        returns (uint256 shares)
    {
        shares = convertToShares(assets);
        _performRedeemRequest(msg.sender, shares, assets);
    }

    /**
     * @dev Request a redemption of shares from the pool.
     *
     * Emits a {WithdrawRequested} event.
     */
    function _performRedeemRequest(
        address owner,
        uint256 shares,
        uint256 assets
    ) internal {
        require(
            _withdrawController.maxRedeemRequest(owner) >= shares,
            "Pool: InsufficientBalance"
        );
        uint256 feeShares = requestFee(shares);
        _burn(owner, feeShares);
        _withdrawController.performRequest(owner, shares);

        emit WithdrawRequested(owner, assets, shares);
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
        maxShares = _withdrawController.maxRequestCancellation(owner);
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
        _performRequestCancellation(msg.sender, shares, assets);
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
        _performRequestCancellation(msg.sender, shares, assets);
    }

    /**
     * @dev Cancels a withdraw request for the owner, including paying any fees.
     * A cancellation can only occur before the
     */
    function _performRequestCancellation(
        address owner,
        uint256 shares,
        uint256 assets
    ) internal {
        // TODO: If we move to a lighter crank, we must run it here before this method continues
        require(
            maxRequestCancellation(owner) >= shares,
            "Pool: InsufficientBalance"
        );
        uint256 feeShares = (shares);
        _burn(owner, feeShares);
        _withdrawController.performRequestCancellation(owner, shares);
        emit WithdrawRequestCancelled(owner, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                            Crank
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Crank the protocol. Issues withdrawals
     */
    function crank() external returns (uint256 redeemableShares) {
        redeemableShares = _withdrawController.crank();
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
    function maxWithdraw(address owner)
        public
        view
        override
        returns (uint256 assets)
    {
        assets = _withdrawController.maxWithdraw(owner);
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
        shares = _withdrawController.previewWithdraw(msg.sender, assets);
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

        // Update the withdraw state
        shares = _withdrawController.withdraw(owner, assets);

        // transfer assets, and burn the shares
        _performWithdrawTransfer(owner, shares, assets);
    }

    /**
     * @dev The maximum amount of shares that can be redeemed from the owner
     * balance through a redeem call.
     */
    function maxRedeem(address owner)
        public
        view
        override
        returns (uint256 maxShares)
    {
        maxShares = _withdrawController.maxRedeem(owner);
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
        assets = _withdrawController.previewRedeem(msg.sender, shares);
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

        // Update the withdraw state
        assets = _withdrawController.redeem(owner, shares);

        // transfer assets, and burn the shares
        _performWithdrawTransfer(owner, shares, assets);
    }

    /**
     * @dev Redeem a number of shares for a given number of assets. This method
     * will transfer `assets` from the vault to the `receiver`, and burn `shares`
     * from `owner`.
     */
    function _performWithdrawTransfer(
        address owner,
        uint256 shares,
        uint256 assets
    ) internal {
        // Transfer assets
        _liquidityAsset.safeTransferFrom(address(this), owner, assets);

        // Burn the shares
        _burn(owner, shares);

        emit Withdraw(owner, owner, owner, assets, shares);
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
