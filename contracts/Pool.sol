// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IServiceConfiguration.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
    }

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function lifeCycleState() external view returns (IPoolLifeCycleState) {
        return _poolLifeCycleState;
    }

    /**
     * @dev The current configurable pool settings.
     */
    function settings()
        external
        view
        returns (IPoolConfigurableSettings memory settings)
    {
        return _poolSettings;
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
     * @dev Returns the withdrawal fee for a given withdrawal amount at the current block.
     */
    function feeForWithdrawalRequest(uint256) external view returns (uint256) {
        return 0;
    }

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

        ILoan(loan).markDefaulted();
        _accountings.activeLoanPrincipals -= ILoan(loan).principal();
        emit LoanDefaulted(loan);
    }

    /*//////////////////////////////////////////////////////////////
                    Withdrawal Request Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev The withdraw period that we're requesting for (aka nextWithdrawPeriod)
     */
    function requestPeriod() public view returns (uint256) {
        return
            PoolLib.currentRequestPeriod(
                poolActivatedAt,
                _poolSettings.withdrawRequestPeriodDuration
            );
    }

    /**
     * @dev The current withdraw period
     */
    function withdrawPeriod() public view returns (uint256) {
        return
            PoolLib.currentWithdrawPeriod(
                poolActivatedAt,
                _poolSettings.withdrawRequestPeriodDuration
            );
    }

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdraw(uint256 amount)
        external
        onlyActivatedPool
        onlyLender
    {
        // TODO: Calculate fees here
        require(balanceOf(msg.sender) >= amount, "Pool: InsufficientBalance");

        uint256 period = requestPeriod();

        // Update the lender's WithdrawState
        if (
            _withdrawState[msg.sender].latestPeriod > 0 &&
            _withdrawState[msg.sender].latestPeriod <= period
        ) {
            _withdrawState[msg.sender].eligible =
                _withdrawState[msg.sender].eligible +
                _withdrawState[msg.sender].requested;
            _withdrawState[msg.sender].requested = 0;
        }

        // Update the global withdraw state
        if (
            _globalWithdrawState.latestPeriod > 0 &&
            _globalWithdrawState.latestPeriod <= period
        ) {
            _globalWithdrawState.eligible =
                _globalWithdrawState.eligible +
                _globalWithdrawState.requested;
            _globalWithdrawState.requested = 0;
        }

        // Update the requested amount from the user
        _withdrawState[msg.sender].requested =
            _withdrawState[msg.sender].requested +
            amount;
        _withdrawState[msg.sender].latestPeriod = period;

        // Update the global amount
        _globalWithdrawState.requested =
            _globalWithdrawState.requested +
            amount;
        _globalWithdrawState.latestPeriod = period;

        emit WithdrawRequested(msg.sender, amount);
    }

    function requestedLenderWithdrawalTotal() external view returns (uint256) {
        uint256 period = withdrawPeriod();

        // Check if there's any new eligible shares need to be added, but
        // has not yet been "cranked"
        if (_globalWithdrawState.latestPeriod <= period) {
            return 0;
        }

        return _globalWithdrawState.requested;
    }

    function eligibleLenderWithdrawalTotal() external view returns (uint256) {
        uint256 period = withdrawPeriod();

        // Check if there's any new eligible shares need to be added, but
        // has not yet been "cranked"
        if (_globalWithdrawState.latestPeriod <= period) {
            return
                _globalWithdrawState.eligible + _globalWithdrawState.requested;
        }

        return _globalWithdrawState.eligible;
    }

    function requestedLenderWithdrawalAmount(address lender)
        external
        view
        returns (uint256)
    {
        uint256 period = withdrawPeriod();

        // Check if there's any new eligible shares need to be added, but
        // has not yet been "cranked"
        if (_withdrawState[lender].latestPeriod <= period) {
            return 0;
        }

        return _withdrawState[lender].requested;
    }

    function eligibleLenderWithdrawalAmount(address lender)
        external
        view
        returns (uint256)
    {
        uint256 period = withdrawPeriod();

        // Check if there's any new eligible shares need to be added, but
        // has not yet been "cranked"
        if (_withdrawState[lender].latestPeriod <= period) {
            return
                _withdrawState[lender].eligible +
                _withdrawState[lender].requested;
        }

        return _withdrawState[lender].eligible;
    }

    /**
     * @dev Set the pool lifecycle state. If the state changes, this method
     * will also update the poolActivatedAt variable
     */
    function _setPoolLifeCycleState(IPoolLifeCycleState state) internal {
        if (_poolLifeCycleState != state) {
            if (state == IPoolLifeCycleState.Active && poolActivatedAt == 0) {
                poolActivatedAt = block.timestamp;
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
        external
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
    function maxWithdraw(address owner)
        external
        view
        override
        returns (uint256)
    {
        // TODO: have to consider how much is available in the withdrawal pool
        uint256 period = withdrawPeriod();

        // Check if there's any new eligible shares need to be added, but
        // has not yet been "cranked"
        if (_withdrawState[owner].latestPeriod <= period) {
            return
                _withdrawState[owner].eligible +
                _withdrawState[owner].requested;
        }

        return _withdrawState[owner].eligible;
    }

    /**
     * @dev Simulate the effects of their withdrawal at the current block.
     */
    function previewWithdraw(uint256 assets)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /**
     * @dev The maximum amount of shares that can be redeemed from the owner balance through a redeem call.
     */
    function maxRedeem(address owner) external view override returns (uint256) {
        return 0;
    }

    /**
     * @dev Simulates the effects of their redeemption at the current block.
     */
    function previewRedeem(uint256 shares)
        external
        view
        override
        returns (uint256)
    {
        return 0;
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

    /**
     * @dev Burns shares from owner and send exactly assets token from the vault to receiver.
     * Emits a {Withdraw} event.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external virtual returns (uint256 shares) {
        return 0;
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
        return 0;
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
