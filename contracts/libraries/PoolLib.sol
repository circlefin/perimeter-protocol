// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/ILoan.sol";
import "../interfaces/IPool.sol";
import "../interfaces/ILoan.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../FirstLossVault.sol";
import "../LoanFactory.sol";

/**
 * @title Collection of functions used by the Pool
 */
library PoolLib {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant RAY = 10**27;

    /**
     * @dev Emitted when first loss is supplied to the pool.
     */
    event FirstLossDeposited(
        address indexed caller,
        address indexed spender,
        uint256 amount
    );

    /**
     * @dev Emitted when first loss is withdrawn from the pool.
     */
    event FirstLossWithdrawn(
        address indexed caller,
        address indexed receiver,
        uint256 amount
    );

    /**
     * @dev See IERC4626 for event definition.
     */
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /**
     * @dev See IPool
     */
    event FirstLossApplied(
        address indexed loan,
        uint256 amount,
        uint256 outstandingLosses
    );

    /**
     * @dev Determines whether an address corresponds to a pool loan
     * @param loan address of loan
     * @param serviceConfiguration address of service configuration
     * @param pool address of pool
     */
    function isPoolLoan(
        address loan,
        address serviceConfiguration,
        address pool
    ) public view returns (bool) {
        address factory = ILoan(loan).factory();
        return
            IServiceConfiguration(serviceConfiguration).isLoanFactory(
                factory
            ) &&
            LoanFactory(factory).isLoan(loan) &&
            ILoan(loan).pool() == pool;
    }

    /**
     * @dev See IPool for event definition
     */
    event LoanDefaulted(address indexed loan);

    /**
     * @dev Math `ceil` method to round up on division
     */
    function ceil(uint256 lhs, uint256 rhs) internal pure returns (uint256) {
        return (lhs + rhs - 1) / rhs;
    }

    /**
     * @dev Transfers first loss to the vault.
     * @param liquidityAsset Pool liquidity asset
     * @param amount Amount of first loss being contributed
     * @param currentState Lifecycle state of the pool
     * @param minFirstLossRequired The minimum amount of first loss the pool needs to become active
     * @return newState The updated Pool lifecycle state
     */
    function executeFirstLossDeposit(
        address liquidityAsset,
        address spender,
        uint256 amount,
        address firstLossVault,
        IPoolLifeCycleState currentState,
        uint256 minFirstLossRequired
    ) external returns (IPoolLifeCycleState newState) {
        require(firstLossVault != address(0), "Pool: 0 address");

        IERC20(liquidityAsset).safeTransferFrom(
            spender,
            firstLossVault,
            amount
        );
        newState = currentState;

        // Graduate pool state if needed
        if (
            currentState == IPoolLifeCycleState.Initialized &&
            (amount >= minFirstLossRequired ||
                IERC20(liquidityAsset).balanceOf(address(firstLossVault)) >=
                minFirstLossRequired)
        ) {
            newState = IPoolLifeCycleState.Active;
        }
        emit FirstLossDeposited(msg.sender, spender, amount);
    }

    /**
     * @dev Withdraws first loss capital. Can only be called by the Pool manager under certain conditions.
     * @param amount Amount of first loss being withdrawn
     * @param withdrawReceiver Where the liquidity should be withdrawn to
     * @param firstLossVault Vault holding first loss
     * @return newState The updated Pool lifecycle state
     */
    function executeFirstLossWithdraw(
        uint256 amount,
        address withdrawReceiver,
        address firstLossVault
    ) external returns (uint256) {
        require(firstLossVault != address(0), "Pool: 0 address");
        require(withdrawReceiver != address(0), "Pool: 0 address");

        FirstLossVault(firstLossVault).withdraw(amount, withdrawReceiver);
        emit FirstLossWithdrawn(msg.sender, withdrawReceiver, amount);
        return amount;
    }

    /**
     * @dev Calculates total sum of expected interest
     * @param activeLoans All active pool loans, i.e. they've been drawndown, and interest is accruing
     * @return expectedInterest The total sum of expected accrued interest at this block
     */
    function calculateExpectedInterest(
        EnumerableSet.AddressSet storage activeLoans
    ) external view returns (uint256 expectedInterest) {
        uint256 paymentsRemaining;
        uint256 paymentDueDate;
        uint256 paymentAmount;
        uint256 paymentPeriod;
        uint256 numberPaymentsLate;
        uint256 paymentPeriodStart;

        for (uint256 i = 0; i < activeLoans.length(); i++) {
            ILoan loan = ILoan(activeLoans.at(i));

            paymentsRemaining = loan.paymentsRemaining();
            paymentDueDate = loan.paymentDueDate();

            // Loan has been fully-paid, or the clock hasn't started yet
            // on the first payment
            if (paymentsRemaining == 0 || paymentDueDate == 0) {
                continue;
            }

            paymentPeriod = loan.paymentPeriod() * 1 days;
            paymentAmount = loan.payment();

            // Determine how many payments loan is late on
            numberPaymentsLate = paymentDueDate < block.timestamp
                ? Math.min(
                    (block.timestamp - paymentDueDate) / paymentPeriod,
                    paymentsRemaining
                )
                : 0;

            // Add late payments in full
            expectedInterest += paymentAmount * numberPaymentsLate;

            // If lender is late on ALL remaining payments, then we're done.
            if (paymentsRemaining == numberPaymentsLate) {
                continue;
            }

            // Otherwise, find how far we are into current period.
            paymentPeriodStart = numberPaymentsLate > 0
                ? paymentDueDate + paymentPeriod * numberPaymentsLate
                : paymentDueDate - paymentPeriod;

            expectedInterest += paymentAmount
                .mul(RAY)
                .mul(block.timestamp - paymentPeriodStart)
                .div(paymentPeriod)
                .div(RAY);
        }

        return expectedInterest;
    }

    /**
     * @dev Computes the exchange rate for converting assets to shares
     * @param assets Amount of assets to exchange
     * @param sharesTotalSupply Supply of Vault's ERC20 shares
     * @param totalAssets Pool total assets
     * @return shares The amount of shares
     */
    function calculateAssetsToShares(
        uint256 assets,
        uint256 sharesTotalSupply,
        uint256 totalAssets
    ) external pure returns (uint256 shares) {
        if (totalAssets == 0) {
            return assets;
        }

        // TODO: add in interest rate.
        uint256 rate = (sharesTotalSupply.mul(RAY)).div(totalAssets);
        shares = (rate.mul(assets)).div(RAY);
    }

    /**
     * @dev Computes the exchange rate for converting shares to assets
     * @param shares Amount of shares to exchange
     * @param sharesTotalSupply Supply of Vault's ERC20 shares
     * @param totalAssets Pool NAV
     * @return assets The amount of shares
     */
    function calculateSharesToAssets(
        uint256 shares,
        uint256 sharesTotalSupply,
        uint256 totalAssets
    ) external pure returns (uint256 assets) {
        if (sharesTotalSupply == 0) {
            return shares;
        }

        // TODO: add in interest rate.
        uint256 rate = (totalAssets.mul(RAY)).div(sharesTotalSupply);
        assets = (rate.mul(shares)).div(RAY);
    }

    /**
     * @dev Calculates total assets held by Vault
     * @param asset Amount of total assets held by the Vault
     * @param vault Address of the ERC4626 vault
     * @param outstandingLoanPrincipals Sum of all oustanding loan principals
     * @return totalAssets Total assets
     */
    function calculateTotalAssets(
        address asset,
        address vault,
        uint256 outstandingLoanPrincipals
    ) external view returns (uint256 totalAssets) {
        totalAssets =
            IERC20(asset).balanceOf(vault) +
            outstandingLoanPrincipals;
    }

    /**
     * @dev Calculates the max deposit allowed in the pool
     * @param poolLifeCycleState The current pool lifecycle state
     * @param poolMaxCapacity Max pool capacity allowed per the pool settings
     * @param totalAssets Sum of all pool assets
     * @return Max deposit allowed
     */
    function calculateMaxDeposit(
        IPoolLifeCycleState poolLifeCycleState,
        uint256 poolMaxCapacity,
        uint256 totalAssets
    ) external pure returns (uint256) {
        return
            poolLifeCycleState == IPoolLifeCycleState.Active
                ? poolMaxCapacity - totalAssets
                : 0;
    }

    /**
     * @dev Executes a deposit into the pool
     * @param asset Pool liquidity asset
     * @param vault Address of ERC4626 vault
     * @param sharesReceiver Address of receiver of shares
     * @param assets Amount of assets being deposited
     * @param shares Amount of shares being minted
     * @param maxDeposit Max allowed deposit into the pool
     * @param mint A pointer to the mint function
     * @return The amount of shares being minted
     */
    function executeDeposit(
        address asset,
        address vault,
        address sharesReceiver,
        uint256 assets,
        uint256 shares,
        uint256 maxDeposit,
        function(address, uint256) mint
    ) internal returns (uint256) {
        require(shares > 0, "Pool: 0 deposit not allowed");
        require(assets <= maxDeposit, "Pool: Exceeds max deposit");

        IERC20(asset).safeTransferFrom(msg.sender, vault, assets);
        mint(sharesReceiver, shares);

        emit Deposit(msg.sender, sharesReceiver, assets, shares);
        return shares;
    }

    /**
     * @dev Executes a default, supplying first-loss to cover losses.
     * @param asset Pool liquidity asset
     * @param firstLossVault Vault holding first-loss capital
     * @param loan Address of loan in default
     * @param accountings Pool accountings to update
     */
    function executeDefault(
        address asset,
        address firstLossVault,
        address loan,
        address pool,
        IPoolAccountings storage accountings
    ) external {
        ILoan(loan).markDefaulted();
        accountings.outstandingLoanPrincipals -= ILoan(loan).principal();

        uint256 firstLossBalance = IERC20(asset).balanceOf(
            address(firstLossVault)
        );

        // TODO - handle open-term loans where principal may
        // not be fully oustanding.
        uint256 outstandingLoanDebt = ILoan(loan).principal() +
            ILoan(loan).paymentsRemaining() *
            ILoan(loan).payment();

        uint256 firstLossRequired = firstLossBalance >= outstandingLoanDebt
            ? outstandingLoanDebt
            : firstLossBalance;

        FirstLossVault(firstLossVault).withdraw(firstLossRequired, pool);

        emit LoanDefaulted(loan);
        emit FirstLossApplied(
            loan,
            firstLossRequired,
            outstandingLoanDebt.sub(firstLossRequired)
        );
    }

    /*//////////////////////////////////////////////////////////////
                    Withdrawal Request Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev The current withdrawal period. Withdraw Requests made prior to this
     * window are eligible to be included in the withdrawal flows.
     */
    function calculateCurrentWithdrawPeriod(
        uint256 currentTimestamp,
        uint256 activatedAt,
        uint256 withdrawalWindowDuration
    ) public pure returns (uint256) {
        if (activatedAt == 0) {
            return 0;
        }
        return (currentTimestamp - activatedAt) / withdrawalWindowDuration;
    }

    function progressWithdrawState(
        IPoolWithdrawState memory state,
        uint256 currentPeriod
    ) public pure returns (IPoolWithdrawState memory) {
        // If the latest withdrawlState has not been updated for this
        // given request period, we need to move "requested" shares over
        // to be "eligible".
        if (state.latestRequestPeriod <= currentPeriod) {
            state.eligibleShares = state.eligibleShares.add(
                state.requestedShares
            );
            state.requestedShares = 0;
        }

        return state;
    }

    /**
     * @dev Calculate the current IPoolWithdrawState based on the existing
     * request state and the current request period.
     */
    function caclulateWithdrawState(
        IPoolWithdrawState memory state,
        uint256 currentPeriod,
        uint256 requestedPeriod,
        uint256 requestedShares
    ) public pure returns (IPoolWithdrawState memory updatedState) {
        require(requestedPeriod > 0, "Pool: Invalid request period");

        updatedState = progressWithdrawState(state, currentPeriod);

        // Increment the requested shares count, and ensure the "latestRequestPeriod"
        // is set to the current request period.
        updatedState.requestedShares = state.requestedShares.add(
            requestedShares
        );
        updatedState.latestRequestPeriod = requestedPeriod;
    }

    /**
     * @dev Calculate the fee for making a withdrawRequest or a redeemRequest.
     * Per the EIP-4626 spec, this method rounds up.
     */
    function calculateRequestFee(uint256 shares, uint256 requestFeeBps)
        public
        pure
        returns (uint256)
    {
        return ceil(shares * requestFeeBps, 10_000);
    }

    /**
     * @dev Calculates the Maximum amount of shares that can be requested
     */
    function calculateMaxRedeemRequest(
        IPoolWithdrawState memory state,
        uint256 shareBalance,
        uint256 requestFeeBps
    ) public pure returns (uint256) {
        uint256 sharesRemaining = shareBalance
            .sub(state.requestedShares)
            .sub(state.eligibleShares)
            .sub(state.redeemableShares);

        uint256 sharesFee = calculateRequestFee(sharesRemaining, requestFeeBps);

        return Math.max(sharesRemaining.sub(sharesFee), 0);
    }

    /**
     * @dev
     */
    function updateWithdrawStateForWithdraw(
        IPoolWithdrawState memory state,
        uint256 assets,
        uint256 shares
    ) public pure returns (IPoolWithdrawState memory) {
        // Decrease the "eligible" shares, because they are moving to
        // "redeemable" (aka "locked" for withdrawal)
        state.eligibleShares = state.eligibleShares.sub(shares);

        // Increment how many shares and assets are "locked" for withdrawal
        state.redeemableShares = state.redeemableShares.add(shares);
        state.withdrawableAssets = state.withdrawableAssets.add(assets);

        return state;
    }
}
