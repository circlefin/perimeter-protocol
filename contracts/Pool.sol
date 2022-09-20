// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPool.sol";
import "./TokenizedVault.sol";
import "./ServiceConfigurable.sol";
import "./PoolConfigurableSettings.sol";
import "./PoolLifeCycleState.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./library/PoolLib.sol";

/**
 * @title Pool
 *
 * Mostly empty Pool contract.
 */
contract Pool is TokenizedVault, IPool {

    /**
     * @dev Modifier that checks that the caller is the pool's manager.
     */
    modifier onlyPM() {
        require(
            _manager != address(0) && msg.sender == _manager,
            "Pool: caller is not PM"
        );
        _;
    }

    /**
     * @dev Modifier that checks that the caller is a pool lender
     */
    modifier onlyLender() {
        require(
            balanceOf(msg.sender) > 0,
            "Pool: caller is not a lender"
        );
        _;
    }

    PoolLifeCycleState public _poolLifeCycleState;
    address public _manager;
    uint256 public _firstLoss;

    PoolConfigurableSettings internal _poolSettings;

    constructor(
        address liquidityType,
        address _poolManager,
        PoolConfigurableSettings memory _settings,
        string memory tokenName,
        string memory tokenSymbol
    ) TokenizedVault(liquidityType, tokenName, tokenSymbol) {
        _manager = _poolManager;
        _poolSettings = _settings;
        _poolLifeCycleState = PoolLifeCycleState.Initialized;
    }

    /**
     * @dev Returns the current pool lifecycle state.
     */
    function lifeCycleState() external view returns (PoolLifeCycleState) {
        return PoolLifeCycleState.Active;
    }

    /**
     * @dev The current configurable pool settings.
     */
    function poolSettings()
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
        return _firstLoss;
    }

    /**
     * @dev Updates the pool capacity. Can only be called by the PM.
     */
    function updatePoolCapacity(uint256) external onlyPM returns (uint256) {}

    /**
     * @dev Updates the pool end date. Can only be called by the PM.
     */
    function updatePoolEndDate(uint256) external onlyPM returns (uint256) {}

    /**
     * @dev Returns the withdrawal fee for a given withdrawal amount at the current block.
     */
    function feeForWithdrawalRequest(uint256) external onlyPM view returns (uint256) {
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
    function requestWithdrawal(uint256) external onlyLender view {}

    /**
     * @dev Called by the pool manager, this transfers liquidity from the pool to a given loan.
     */
    function fundLoan(address) external onlyPM {}

    /**
     * @dev Called by the pool manager, marks a loan as in default, updating pool accounting and allowing loan
     * collateral to be claimed.
     */
    function markLoanAsInDefault(address) external onlyPM {}

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
}
