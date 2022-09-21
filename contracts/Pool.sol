// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPool.sol";
import "./ServiceConfigurable.sol";
import "./PoolConfigurableSettings.sol";
import "./PoolLifeCycleState.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./library/PoolLib.sol";
import "./FirstLossLocker.sol";

/**
 * @title Pool
 *
 * Mostly empty Pool contract.
 */
contract Pool is IPool, ERC20 {
    using SafeERC20 for IERC20;

    PoolLifeCycleState private _poolLifeCycleState;
    address private _manager;
    IERC20 private _liquidityAsset;
    PoolConfigurableSettings private _poolSettings;
    FirstLossLocker private _firstLossLocker;

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
    modifier poolInitializedOrActive() {
        require(
            _poolLifeCycleState == PoolLifeCycleState.Active ||
                _poolLifeCycleState == PoolLifeCycleState.Initialized,
            "Pool: invalid pool state"
        );
        _;
    }

    /**
     * @dev Constructor for Pool
     * @param liquidityAsset asset held by the poo
     * @param poolManager manager of the pool
     * @param poolSettings configurable settings for the pool
     * @param tokenName Name used for issued pool tokens
     * @param tokenSymbol Symbol used for issued pool tokens
     */
    constructor(
        address liquidityAsset,
        address poolManager,
        PoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {
        _liquidityAsset = IERC20(liquidityAsset);
        _poolSettings = poolSettings;
        _manager = poolManager;
        _poolLifeCycleState = PoolLifeCycleState.Initialized;

        _firstLossLocker = new FirstLossLocker(address(this), liquidityAsset);
    }

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function lifeCycleState() external view returns (PoolLifeCycleState) {
        return _poolLifeCycleState;
    }

    /**
     * @dev The current configurable pool settings.
     */
    function settings()
        external
        view
        returns (PoolConfigurableSettings memory settings)
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
        return _liquidityAsset.balanceOf(address(_firstLossLocker));
    }

    /**
     * @dev Supplies first-loss to the pool. Can only be called by the Pool Manager.
     */
    function supplyFirstLoss(uint256 amount)
        external
        onlyManager
        poolInitializedOrActive
    {
        _poolLifeCycleState = PoolLib.executeFirstLossContribution(
            address(_liquidityAsset),
            amount,
            address(_firstLossLocker),
            _poolLifeCycleState,
            _poolSettings.firstLossInitialMinimum
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
     * @dev Returns the next withdrawal window, at which a withdrawal could be completed.
     */
    function nextWithdrawalWindow(uint256)
        external
        view
        returns (PoolWithdrawalPeriod memory)
    {
        return PoolWithdrawalPeriod(0, 0);
    }

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdrawal(uint256) external view onlyLender {}

    /**
     * @dev Called by the pool manager, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address) external onlyManager {}

    /**
     * @dev Called by the pool manager, marks a loan as in default, updating pool accounting and allowing loan
     * collateral to be claimed.
     */
    function markLoanAsInDefault(address) external onlyManager {}

    /*//////////////////////////////////////////////////////////////
                        ERC-4246 Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Calculates the amount of shares that would be exchanged by the vault for the amount of assets provided.
     */
    function convertToShares(uint256 assets)
        external
        view
        override
        returns (uint256)
    {}

    /**
     * @dev Calculates the amount of assets that would be exchanged by the vault for the amount of shares provided.
     */
    function convertToAssets(uint256 shares)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /**
     * @dev Calculates the maximum amount of underlying assets that can be deposited in a single deposit call by the receiver.
     */
    function maxDeposit(address receiver)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /**
     * @dev Allows users to simulate the effects of their deposit at the current block.
     */
    function previewDeposit(uint256 assets)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /**
     * @dev Returns the maximum amount of shares that can be minted in a single mint call by the receiver.
     */
    function maxMint(address receiver)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /**
     * @dev Allows users to simulate the effects of their mint at the current block.
     */
    function previewMint(uint256 shares)
        external
        view
        override
        returns (uint256)
    {
        return 0;
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
        return 0;
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
    function asset() external view returns (address) {
        return address(_liquidityAsset);
    }

    /**
     * @dev Calculate the total amount of underlying assets held by the vault.
     */
    function totalAssets() external view returns (uint256) {
        return 0;
    }

    /**
     * @dev Deposits assets of underlying tokens into the vault and grants ownership of shares to receiver.
     * Emits a {Deposit} event.
     */
    function deposit(uint256 assets, address receiver)
        external
        returns (uint256 shares)
    {
        return 0;
    }

    /**
     * @dev Mints exactly shares vault shares to receiver by depositing assets of underlying tokens.
     * Emits a {Deposit} event.
     */
    function mint(uint256 shares, address receiver)
        external
        returns (uint256 assets)
    {
        return 0;
    }

    /**
     * @dev Burns shares from owner and send exactly assets token from the vault to receiver.
     * Emits a {Withdraw} event.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
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
    ) external returns (uint256 assets) {
        return 0;
    }
}
