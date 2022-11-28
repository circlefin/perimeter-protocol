// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/ILoan.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./controllers/interfaces/IWithdrawController.sol";
import "./controllers/interfaces/IPoolController.sol";
import "./factories/interfaces/IWithdrawControllerFactory.sol";
import "./factories/interfaces/IPoolControllerFactory.sol";
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

    IERC20 private _liquidityAsset;
    FeeVault private _feeVault;
    IPoolAccountings private _accountings;

    IWithdrawController public withdrawController;
    IPoolController public poolController;

    /**
     * @dev list of all active loan addresses for this Pool. Active loans have been
     * drawn down, and the payment schedule activated.
     */
    EnumerableSet.AddressSet private _fundedLoans;

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
     * @dev Constructor for Pool
     * @param liquidityAsset asset held by the poo
     * @param poolAdmin admin of the pool
     * @param serviceConfiguration address of global service configuration
     * @param withdrawControllerFactory factory address of the withdraw controller
     * @param poolSettings configurable settings for the pool
     * @param tokenName Name used for issued pool tokens
     * @param tokenSymbol Symbol used for issued pool tokens
     */
    constructor(
        address liquidityAsset,
        address poolAdmin,
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {
        _liquidityAsset = IERC20(liquidityAsset);
        _feeVault = new FeeVault(address(this));

        // Build the withdraw controller
        withdrawController = IWithdrawController(
            IWithdrawControllerFactory(withdrawControllerFactory)
                .createController(address(this))
        );

        // Build the admin controller
        poolController = IPoolController(
            IPoolControllerFactory(poolControllerFactory).createController(
                address(this),
                serviceConfiguration,
                poolAdmin,
                liquidityAsset,
                poolSettings
            )
        );

        // Allow the contract to move infinite amount of vault liquidity assets
        _liquidityAsset.safeApprove(address(this), type(uint256).max);
    }

    /**
     * @dev The current configurable pool settings.
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
     * @dev The admin of the pool
     */
    function admin() external view override returns (address) {
        return poolController.admin();
    }

    /**
     * @dev The address of the fee vault.
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
     * @dev The pool accounting variables;
     */
    function accountings() external view returns (IPoolAccountings memory) {
        return _accountings;
    }

    /**
     * @dev The fee
     */
    function poolFeePercentOfInterest() external view returns (uint256) {
        return settings().poolFeePercentOfInterest;
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
    function hasFundedLoans() external view returns (bool) {
        return _fundedLoans.length() > 0;
    }

    /**
     * @inheritdoc IPool
     */
    function fundLoan(address addr) external onlyPoolController {
        ILoan loan = ILoan(addr);
        uint256 principal = loan.principal();

        require(totalAvailableAssets() >= principal, "Pool: not enough assets");

        _liquidityAsset.safeApprove(addr, principal);
        loan.fund();

        _accountings.outstandingLoanPrincipals += principal;
        _fundedLoans.add(addr);

        emit LoanFunded(addr, principal);
    }

    /**
     * @inheritdoc IPool
     */
    function removeFundedLoan(address addr) external onlyPoolController {
        require(_fundedLoans.remove(addr), "Pool: unfunded loan");
        _accountings.outstandingLoanPrincipals -= ILoan(addr).principal();
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
    function liquidityPoolAssets() public view returns (uint256 assets) {
        assets = PoolLib.calculateTotalAvailableAssets(
            address(_liquidityAsset),
            address(this),
            0, // do not include any loan principles
            withdrawController.totalWithdrawableAssets()
        );
    }

    function claimFixedFee(
        address recipient,
        uint256 fixedFee,
        uint256 fixedFeeInterval
    ) external onlyPoolController {
        require(
            _accountings.fixedFeeDueDate < block.timestamp,
            "Pool: fixed fee not due"
        );

        _accountings.fixedFeeDueDate += fixedFeeInterval * 1 days;
        IERC20(_liquidityAsset).safeTransfer(recipient, fixedFee);
    }

    /*//////////////////////////////////////////////////////////////
                Withdraw Controller Proxy Methods
    //////////////////////////////////////////////////////////////*/

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
        maxShares = withdrawController.maxRedeemRequest(owner);
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
        assets = withdrawController.previewRedeemRequest(shares);
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
        shares = withdrawController.previewWithdrawRequest(assets);
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
            withdrawController.maxRedeemRequest(owner) >= shares,
            "Pool: InsufficientBalance"
        );
        uint256 feeShares = poolController.requestFee(shares);
        _burn(owner, feeShares);
        withdrawController.performRequest(owner, shares);

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
        maxShares = withdrawController.maxRequestCancellation(owner);
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
        require(
            maxRequestCancellation(owner) >= shares,
            "Pool: InsufficientBalance"
        );
        withdrawController.performRequestCancellation(owner, shares);
        uint256 feeShares = (shares);
        _burn(owner, feeShares);
        emit WithdrawRequestCancelled(owner, assets, shares);
    }

    /*//////////////////////////////////////////////////////////////
                            Crank
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Crank the protocol. Issues withdrawals
     */
    function crank() external returns (uint256 redeemableShares) {
        redeemableShares = withdrawController.crank();
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
                poolController.state(),
                settings().maxCapacity,
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
                totalAvailableSupply(),
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
        assets = withdrawController.maxWithdraw(owner);
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
        shares = withdrawController.previewWithdraw(msg.sender, assets);
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
        shares = withdrawController.withdraw(owner, assets);

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
        maxShares = withdrawController.maxRedeem(owner);
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
        assets = withdrawController.previewRedeem(msg.sender, shares);
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
