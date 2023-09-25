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

import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./controllers/interfaces/IWithdrawController.sol";
import "./controllers/interfaces/IPoolController.sol";
import "./factories/interfaces/IWithdrawControllerFactory.sol";
import "./factories/interfaces/IPoolControllerFactory.sol";
import "./factories/interfaces/IVaultFactory.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "./libraries/PoolLib.sol";
import "./upgrades/BeaconImplementation.sol";

/**
 * @title Liquidity pool for Perimeter.
 * @dev Used through a beacon proxy.
 */
contract Pool is IPool, ERC20Upgradeable, BeaconImplementation {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev Reference to the global service configuration.
     */
    IServiceConfiguration private _serviceConfiguration;

    /**
     * @dev Reference to the underlying liquidity asset for the pool.
     */
    IERC20Upgradeable private _liquidityAsset;

    /**
     * @dev A vault holding pool admin fees collected from borrower payments.
     */
    IVault private _feeVault;

    /**
     * @dev Various accounting statistics updated throughout the pool lifetime.
     */
    IPoolAccountings private _accountings;

    /**
     * @dev Reference to the withdraw controller for the pool.
     */
    IWithdrawController public withdrawController;

    /**
     * @dev Reference to the admin's controller for the pool.
     */
    IPoolController public poolController;

    /**
     * @dev list of all active loan addresses for this Pool. Active loans have been
     * drawn down, and the payment schedule activated.
     */
    EnumerableSet.AddressSet private _activeLoans;

    /**
     * @dev Mapping of funded loan addresses.
     */
    mapping(address => bool) private _fundedLoans;

    /**
     * @inheritdoc IPool
     */
    uint256 public activatedAt;

    /**
     * @dev Modifier to ensure only the PoolController calls a method.
     */
    modifier onlyPoolController() {
        require(
            address(poolController) != address(0) &&
                msg.sender == address(poolController),
            "Pool: caller is not pool controller"
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
        require(activatedAt > 0, "Pool: PoolNotActive");
        _;
    }

    /**
     * @dev Modifier to check that the protocol is not paused
     */
    modifier onlyNotPaused() {
        require(!_serviceConfiguration.paused(), "Pool: Protocol paused");
        _;
    }

    /**
     * @dev Modifier that checks that the pool is Initialized or Active
     */
    modifier atState(IPoolLifeCycleState state_) {
        require(
            poolController.state() == state_,
            "Pool: FunctionInvalidAtThisLifeCycleState"
        );
        _;
    }

    /**
     * @dev Modifier to ensure the Pool is snapshotted before proceeding..
     */
    modifier onlySnapshottedPool() {
        _performSnapshot();
        _;
    }

    /**
     * @dev Modifier that can be overriden by derived classes to enforce
     * access control.
     */
    modifier onlyPermittedLender() virtual {
        _;
    }

    /**
     * @dev Initializer for Pool
     * @param liquidityAsset asset held by the poo
     * @param poolAdmin admin of the pool
     * @param serviceConfiguration_ address of global service configuration
     * @param withdrawControllerFactory factory address of the withdraw controller
     * @param poolControllerFactory factory address for emitting pool controllers
     * @param vaultFactory factory address of the Vault
     * @param poolSettings configurable settings for the pool
     * @param tokenName Name used for issued pool tokens
     * @param tokenSymbol Symbol used for issued pool tokens
     */
    function initialize(
        address liquidityAsset,
        address poolAdmin,
        address serviceConfiguration_,
        address withdrawControllerFactory,
        address poolControllerFactory,
        address vaultFactory,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) public initializer {
        __ERC20_init(tokenName, tokenSymbol);
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration_);
        _liquidityAsset = IERC20Upgradeable(liquidityAsset);
        _feeVault = IVault(
            IVaultFactory(vaultFactory).createVault(address(this))
        );

        // Build the withdraw controller
        withdrawController = IWithdrawController(
            IWithdrawControllerFactory(withdrawControllerFactory)
                .createController(address(this))
        );

        // Build the admin controller
        poolController = IPoolController(
            IPoolControllerFactory(poolControllerFactory).createController(
                address(this),
                serviceConfiguration_,
                poolAdmin,
                liquidityAsset,
                vaultFactory,
                poolSettings
            )
        );

        // Allow the contract to move infinite amount of vault liquidity assets
        _liquidityAsset.safeApprove(address(this), type(uint256).max);
    }

    /**
     * @inheritdoc IPool
     */
    function serviceConfiguration()
        public
        view
        returns (IServiceConfiguration)
    {
        return _serviceConfiguration;
    }

    /**
     * @inheritdoc IPool
     */
    function settings()
        public
        view
        returns (IPoolConfigurableSettings memory poolSettings)
    {
        return poolController.settings();
    }

    /**
     * @inheritdoc IPool
     */
    function state() public view returns (IPoolLifeCycleState) {
        return poolController.state();
    }

    /**
     * @inheritdoc IPool
     */
    function admin() external view override returns (address) {
        return poolController.admin();
    }

    /**
     * @inheritdoc IPool
     */
    function feeVault() external view override returns (address) {
        return address(_feeVault);
    }

    /**
     * @inheritdoc IPool
     */
    function firstLossVault() public view returns (address) {
        return address(poolController.firstLossVault());
    }

    /**
     * @inheritdoc IPool
     */
    function accountings()
        external
        view
        override
        returns (IPoolAccountings memory)
    {
        return _accountings;
    }

    /**
     * @inheritdoc IPool
     */
    function serviceFeeBps() external view returns (uint256) {
        return settings().serviceFeeBps;
    }

    /**
     * @inheritdoc IPool
     */
    function onActivated() external onlyPoolController {
        IPoolConfigurableSettings memory _settings = settings();

        activatedAt = block.timestamp;

        if (_settings.fixedFee != 0) {
            _accountings.fixedFeeDueDate =
                block.timestamp +
                _settings.fixedFeeInterval *
                1 days;
        }
    }

    /**
     * @inheritdoc IPool
     */
    function fundLoan(
        address addr
    ) external onlyNotPaused onlyPoolController onlySnapshottedPool {
        require(!_fundedLoans[addr], "Pool: already funded");
        _fundedLoans[addr] = true;
        ILoan loan = ILoan(addr);
        uint256 principal = loan.principal();

        require(liquidityPoolAssets() >= principal, "Pool: not enough assets");

        _liquidityAsset.safeApprove(addr, principal);
        loan.fund();

        _accountings.outstandingLoanPrincipals += principal;

        emit LoanFunded(addr, principal);
    }

    /**
     * @inheritdoc IPool
     */
    function activeLoans() external view override returns (address[] memory) {
        return _activeLoans.values();
    }

    /**
     * @inheritdoc IPool
     */
    function isActiveLoan(address loan) external view override returns (bool) {
        return _activeLoans.contains(loan);
    }

    /**
     * @inheritdoc IPool
     */
    function numActiveLoans() external view override returns (uint256) {
        return _activeLoans.length();
    }

    /**
     * @inheritdoc IPool
     */
    function onLoanPrincipalReturned(uint256 amount) external {
        require(_fundedLoans[msg.sender], "Pool: not funded loan");
        _accountings.outstandingLoanPrincipals -= amount;
    }

    /**
     * @inheritdoc IPool
     */
    function onLoanStateTransitioned() external override {
        require(_fundedLoans[msg.sender], "Pool: not funded loan");

        ILoanLifeCycleState loanState = ILoan(msg.sender).state();
        if (
            loanState == ILoanLifeCycleState.Matured ||
            loanState == ILoanLifeCycleState.Defaulted
        ) {
            require(_activeLoans.remove(msg.sender), "Pool: not active loan");
        } else if (loanState == ILoanLifeCycleState.Active) {
            _activeLoans.add(msg.sender);
        }
    }

    /**
     * @inheritdoc IPool
     */
    function onLoanDefaulted(
        address loan,
        uint256 firstLossApplied
    ) external override onlyPoolController {
        uint256 outstandingPrincipal = ILoan(loan).outstandingPrincipal();
        _accountings.outstandingLoanPrincipals -= outstandingPrincipal;
        _accountings.totalDefaults += outstandingPrincipal;
        _accountings.totalFirstLossApplied += firstLossApplied;
    }

    /**
     * @inheritdoc IPool
     */
    function onLoanWillMakePayment() external override {
        require(_activeLoans.contains(msg.sender), "Pool: caller not loan");
        _performSnapshot();
    }

    /**
     * @inheritdoc IPool
     */
    function totalAvailableAssets() public view returns (uint256 assets) {
        assets = PoolLib.calculateTotalAvailableAssets(
            address(_liquidityAsset),
            address(this),
            _accountings.outstandingLoanPrincipals,
            withdrawController.totalWithdrawableAssets()
        );
    }

    /**
     * @inheritdoc IPool
     */
    function totalAvailableSupply()
        public
        view
        override
        returns (uint256 shares)
    {
        shares = PoolLib.calculateTotalAvailableShares(
            address(this),
            withdrawController.totalRedeemableShares()
        );
    }

    /**
     * @inheritdoc IPool
     */
    function currentExpectedInterest()
        external
        view
        override
        returns (uint256)
    {
        return PoolLib.calculateExpectedInterest(_activeLoans);
    }

    /**
     * @inheritdoc IPool
     */
    function liquidityPoolAssets() public view returns (uint256 assets) {
        assets = PoolLib.calculateTotalAvailableAssets(
            address(_liquidityAsset),
            address(this),
            0, // do not include any loan principles
            withdrawController.totalWithdrawableAssets()
        );
    }

    /**
     * @inheritdoc IPool
     */
    function claimFixedFee(
        address recipient,
        uint256 fixedFee,
        uint256 fixedFeeInterval
    ) external onlyNotPaused onlyPoolController onlySnapshottedPool {
        require(
            _accountings.fixedFeeDueDate < block.timestamp,
            "Pool: fixed fee not due"
        );

        _accountings.fixedFeeDueDate += fixedFeeInterval * 1 days;
        IERC20Upgradeable(_liquidityAsset).safeTransfer(recipient, fixedFee);
    }

    /**
     * @inheritdoc IPool
     */
    function withdrawFeeVault(
        uint256 amount,
        address receiver
    ) external onlyNotPaused onlyPoolController onlySnapshottedPool {
        _feeVault.withdrawERC20(address(_liquidityAsset), amount, receiver);
    }

    /*//////////////////////////////////////////////////////////////
                Withdraw Controller Proxy Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function maxRedeemRequest(
        address owner
    ) public view returns (uint256 maxShares) {
        maxShares = withdrawController.maxRedeemRequest(owner);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function maxWithdrawRequest(
        address owner
    ) public view returns (uint256 maxAssets) {
        maxAssets = convertToAssets(maxRedeemRequest(owner));
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function previewRedeemRequest(
        uint256 shares
    ) external view returns (uint256 assets) {
        assets = withdrawController.previewRedeemRequest(shares);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function previewRedeemRequestFees(
        uint256 shares
    ) external view returns (uint256 feeShares) {
        feeShares = withdrawController.previewRedeemRequestFees(shares);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function previewWithdrawRequest(
        uint256 assets
    ) external view returns (uint256 shares) {
        shares = withdrawController.previewWithdrawRequest(assets);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function previewWithdrawRequestFees(
        uint256 assets
    ) external view returns (uint256 feeShares) {
        feeShares = withdrawController.previewWithdrawRequestFees(assets);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function requestRedeem(
        uint256 shares
    )
        external
        onlyNotPaused
        onlyActivatedPool
        onlyPermittedLender
        onlyLender
        onlySnapshottedPool
        returns (uint256 assets)
    {
        assets = convertToAssets(shares);
        _performRedeemRequest(msg.sender, shares, assets);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function requestWithdraw(
        uint256 assets
    )
        external
        onlyNotPaused
        onlyActivatedPool
        onlyPermittedLender
        onlyLender
        onlySnapshottedPool
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
            withdrawController.maxRedeemRequest(owner) >= shares,
            "Pool: InsufficientBalance"
        );
        uint256 feeShares = poolController.requestFee(shares);
        _burn(owner, feeShares);
        withdrawController.performRequest(owner, shares);

        emit WithdrawRequested(owner, assets, shares);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function maxRequestCancellation(
        address owner
    ) public view returns (uint256 maxShares) {
        maxShares = withdrawController.maxRequestCancellation(owner);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function cancelRedeemRequest(
        uint256 shares
    )
        external
        onlyNotPaused
        onlyActivatedPool
        onlyPermittedLender
        onlyLender
        onlySnapshottedPool
        returns (uint256 assets)
    {
        assets = convertToAssets(shares);
        _performRequestCancellation(msg.sender, shares, assets);
    }

    /**
     * @inheritdoc IRequestWithdrawable
     */
    function cancelWithdrawRequest(
        uint256 assets
    )
        external
        onlyNotPaused
        onlyActivatedPool
        onlyPermittedLender
        onlyLender
        onlySnapshottedPool
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
        require(
            maxRequestCancellation(owner) >= shares,
            "Pool: InsufficientBalance"
        );
        uint256 feeShares = poolController.requestCancellationFee(shares);
        _burn(owner, feeShares);
        withdrawController.performRequestCancellation(owner, shares);

        emit WithdrawRequestCancelled(owner, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                            Snapshot
    //////////////////////////////////////////////////////////////*/

    /**
     * @inheritdoc IPool
     */
    function snapshot() public virtual onlyNotPaused {
        _performSnapshot();
    }

    /**
     * @dev Internal snapshot function run lazily.
     */
    function _performSnapshot() internal {
        (
            uint256 period,
            uint256 redeemableShares,
            uint256 withdrawableAssets,
            bool periodSnapshotted
        ) = withdrawController.snapshot(poolController.withdrawGate());
        if (periodSnapshotted) {
            emit PoolSnapshotted(period, redeemableShares, withdrawableAssets);
        }
    }

    /**
     * @inheritdoc IPool
     */
    function claimSnapshots(
        uint256 limit
    )
        external
        onlyNotPaused
        onlyPermittedLender
        onlyLender
        onlySnapshottedPool
        returns (uint256 shares, uint256 assets)
    {
        return withdrawController.claimSnapshots(msg.sender, limit);
    }

    /**
     * @inheritdoc IPool
     */
    function claimRequired(address lender) public view returns (bool) {
        return withdrawController.claimRequired(lender);
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
     * @inheritdoc IERC4626
     */
    function convertToShares(
        uint256 assets
    ) public view override returns (uint256 shares) {
        shares = PoolLib.calculateSharesFromAssets(
            assets,
            totalAvailableSupply(),
            totalAvailableAssets(),
            false
        );
    }

    /**
     * @inheritdoc IERC4626
     */
    function convertToAssets(
        uint256 shares
    ) public view override returns (uint256 assets) {
        assets = PoolLib.calculateAssetsFromShares(
            shares,
            totalAvailableAssets(),
            totalAvailableSupply(),
            false
        );
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxDeposit(
        address
    ) public view virtual override returns (uint256) {
        if (_serviceConfiguration.paused() == true) {
            return 0;
        }
        return
            PoolLib.calculateMaxDeposit(
                poolController.state(),
                settings().maxCapacity,
                totalAvailableAssets()
            );
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewDeposit(
        uint256 assets
    ) public view override returns (uint256 shares) {
        shares = PoolLib.calculateSharesFromAssets(
            assets,
            totalAvailableSupply(),
            totalAvailableAssets() +
                PoolLib.calculateExpectedInterest(_activeLoans),
            false
        );
    }

    /**
     * @inheritdoc IERC4626
     */
    function deposit(
        uint256 assets,
        address receiver
    )
        public
        virtual
        override
        onlyNotPaused
        atState(IPoolLifeCycleState.Active)
        onlyPermittedLender
        onlySnapshottedPool
        returns (uint256 shares)
    {
        require(msg.sender == receiver, "Pool: invalid receiver");
        shares = PoolLib.executeDeposit(
            asset(),
            address(this),
            receiver,
            assets,
            previewDeposit(assets),
            maxDeposit(receiver),
            _mint,
            _accountings
        );
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxMint(
        address receiver
    ) public view virtual override returns (uint256) {
        return previewDeposit(maxDeposit(receiver));
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewMint(
        uint256 shares
    ) public view override returns (uint256 assets) {
        assets = PoolLib.calculateAssetsFromShares(
            shares,
            totalAvailableAssets() +
                PoolLib.calculateExpectedInterest(_activeLoans),
            totalAvailableSupply(),
            true
        );
    }

    /**
     * @inheritdoc IERC4626
     */
    function mint(
        uint256 shares,
        address receiver
    )
        public
        virtual
        override
        onlyNotPaused
        atState(IPoolLifeCycleState.Active)
        onlyPermittedLender
        onlySnapshottedPool
        returns (uint256 assets)
    {
        require(msg.sender == receiver, "Pool: invalid receiver");
        assets = previewMint(shares);
        PoolLib.executeDeposit(
            asset(),
            address(this),
            receiver,
            assets,
            previewDeposit(assets),
            maxDeposit(receiver),
            _mint,
            _accountings
        );
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxWithdraw(
        address owner
    ) public view virtual override returns (uint256 assets) {
        if (_serviceConfiguration.paused() == true) {
            return 0;
        }
        assets = withdrawController.maxWithdraw(owner);
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewWithdraw(
        uint256 assets
    ) external view override returns (uint256 shares) {
        shares = withdrawController.previewWithdraw(msg.sender, assets);
    }

    /**
     * @inheritdoc IERC4626
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    )
        public
        virtual
        onlyNotPaused
        onlyPermittedLender
        onlySnapshottedPool
        returns (uint256 shares)
    {
        require(receiver == owner, "Pool: Withdrawal to unrelated address");
        require(receiver == msg.sender, "Pool: Must transfer to msg.sender");
        require(assets > 0, "Pool: 0 withdraw not allowed");
        require(maxWithdraw(owner) >= assets, "Pool: InsufficientBalance");

        // Update the withdraw state
        shares = withdrawController.withdraw(owner, assets);

        // transfer assets, and burn the shares
        _performWithdrawTransfer(owner, shares, assets);
    }

    /**
     * @inheritdoc IERC4626
     */
    function maxRedeem(
        address owner
    ) public view virtual override returns (uint256 maxShares) {
        if (_serviceConfiguration.paused() == true) {
            return 0;
        }
        maxShares = withdrawController.maxRedeem(owner);
    }

    /**
     * @inheritdoc IERC4626
     */
    function previewRedeem(
        uint256 shares
    ) external view override returns (uint256 assets) {
        assets = withdrawController.previewRedeem(msg.sender, shares);
    }

    /**
     * @inheritdoc IERC4626
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    )
        public
        virtual
        onlyNotPaused
        onlyPermittedLender
        onlySnapshottedPool
        returns (uint256 assets)
    {
        require(receiver == owner, "Pool: Withdrawal to unrelated address");
        require(receiver == msg.sender, "Pool: Must transfer to msg.sender");
        require(shares > 0, "Pool: 0 redeem not allowed");
        require(maxRedeem(owner) >= shares, "Pool: InsufficientBalance");

        // Update the withdraw state
        assets = withdrawController.redeem(owner, shares);

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

        // Updating accountings
        _accountings.totalAssetsWithdrawn += assets;

        emit Withdraw(owner, owner, owner, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                            ERC-20 Overrides
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Disables Perimeter Pool Token transfers.
     */
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
