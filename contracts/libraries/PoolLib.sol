// SPDX-License-Identifier: MIT
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
import "../interfaces/IVault.sol";
import "../factories/LoanFactory.sol";

/**
 * @title Collection of functions used by the Pool and PoolController.
 */
library PoolLib {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public constant RAY = 10**27;
    /**
     * @dev See IPoolController
     */
    event FirstLossDeposited(
        address indexed caller,
        address indexed spender,
        uint256 amount
    );

    /**
     * @dev See IPoolController
     */
    event FirstLossWithdrawn(
        address indexed caller,
        address indexed receiver,
        uint256 amount
    );

    /**
     * @dev See IPoolController
     */
    event FirstLossApplied(address indexed loan, uint256 amount);

    /**
     * @dev See IERC4626
     */
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /**
     * @dev See IPoolController
     */
    event LoanDefaulted(address indexed loan);

    /**
     * @dev See IPoolController
     */
    event PoolSettingsUpdated();

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
     * @dev Divide two numbers and round the result up
     */
    function divideCeil(uint256 lhs, uint256 rhs)
        internal
        pure
        returns (uint256)
    {
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
     * @dev Withdraws first loss capital. Can only be called by the Pool admin under certain conditions.
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
            if (loan.state() != ILoanLifeCycleState.Active) {
                continue;
            }

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
     * @param input The input to the conversion
     * @param numerator Numerator of the conversion rate
     * @param denominator Denominator of the conversion rate
     * @param roundUp Whether it should be rounded up or down.
     * @return output The converted amount
     */
    function calculateConversion(
        uint256 input,
        uint256 numerator,
        uint256 denominator,
        bool roundUp
    ) public pure returns (uint256 output) {
        if (numerator == 0 || denominator == 0) {
            return input;
        }

        uint256 rate = numerator.mul(RAY).div(denominator);
        if (roundUp) {
            return divideCeil(rate.mul(input), RAY);
        } else {
            return rate.mul(input).div(RAY);
        }
    }

    /**
     * @dev Calculates the exchange rate for converting assets to shares
     */
    function calculateSharesFromAssets(
        uint256 assets,
        uint256 totalShares,
        uint256 totalAssets,
        bool roundUp
    ) external pure returns (uint256) {
        require(isSolvent(totalAssets, totalShares), "POOL_INSOLVENT");

        return calculateConversion(assets, totalShares, totalAssets, roundUp);
    }

    /**
     * @dev Calculates the exchange rate for converting shares to assets
     */
    function calculateAssetsFromShares(
        uint256 shares,
        uint256 totalAssets,
        uint256 totalShares,
        bool roundUp
    ) external pure returns (uint256) {
        require(isSolvent(totalAssets, totalShares), "POOL_INSOLVENT");

        return calculateConversion(shares, totalAssets, totalShares, roundUp);
    }

    /**
     * @dev Private method to determine if a pool is solvent given
     * the parameters.
     *
     * If the pool has assets, it is solvent. If no assets are available,
     * but no shares have been issued, it is solvent. Otherwise, it is insolvent.
     */
    function isSolvent(uint256 totalAssets, uint256 totalShares)
        private
        pure
        returns (bool)
    {
        return totalAssets > 0 || totalShares == 0;
    }

    /**
     * @dev Calculates total assets held by Vault (including those marked for withdrawal)
     * @param asset Amount of total assets held by the Vault
     * @param vault Address of the ERC4626 vault
     * @param outstandingLoanPrincipals Sum of all oustanding loan principals
     * @return totalAssets Total assets
     */
    function calculateTotalAssets(
        address asset,
        address vault,
        uint256 outstandingLoanPrincipals
    ) public view returns (uint256 totalAssets) {
        totalAssets =
            IERC20(asset).balanceOf(vault) +
            outstandingLoanPrincipals;
    }

    /**
     * @dev Calculates total assets held by Vault (excluding marked for withdrawal)
     * @param asset Amount of total assets held by the Vault
     * @param vault Address of the ERC4626 vault
     * @param outstandingLoanPrincipals Sum of all oustanding loan principals
     * @param withdrawableAssets Sum of all withdrawable assets
     * @return totalAvailableAssets Total available assets (excluding marked for withdrawal)
     */
    function calculateTotalAvailableAssets(
        address asset,
        address vault,
        uint256 outstandingLoanPrincipals,
        uint256 withdrawableAssets
    ) external view returns (uint256 totalAvailableAssets) {
        totalAvailableAssets =
            calculateTotalAssets(asset, vault, outstandingLoanPrincipals) -
            withdrawableAssets;
    }

    /**
     * @dev Calculates total shares held by Vault (excluding marked for redemption)
     * @param vault Address of the ERC4626 vault
     * @param redeemableShares Sum of all withdrawable assets
     * @return totalAvailableShares Total redeemable shares (excluding marked for redemption)
     */
    function calculateTotalAvailableShares(
        address vault,
        uint256 redeemableShares
    ) external view returns (uint256 totalAvailableShares) {
        totalAvailableShares = IERC20(vault).totalSupply() - redeemableShares;
    }

    /**
     * @dev Calculates the max deposit allowed in the pool
     * @param poolLifeCycleState The current pool lifecycle state
     * @param poolMaxCapacity Max pool capacity allowed per the pool settings
     * @param totalAvailableAssets Sum of all pool assets (excluding marked for withdrawal)
     * @return Max deposit allowed
     */
    function calculateMaxDeposit(
        IPoolLifeCycleState poolLifeCycleState,
        uint256 poolMaxCapacity,
        uint256 totalAvailableAssets
    ) external pure returns (uint256) {
        uint256 remainingCapacity = poolMaxCapacity > totalAvailableAssets
            ? poolMaxCapacity - totalAvailableAssets
            : 0;
        return
            poolLifeCycleState == IPoolLifeCycleState.Active
                ? remainingCapacity
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
        function(address, uint256) mint,
        IPoolAccountings storage accountings
    ) internal returns (uint256) {
        require(shares > 0, "Pool: 0 deposit not allowed");
        require(assets <= maxDeposit, "Pool: Exceeds max deposit");

        IERC20(asset).safeTransferFrom(msg.sender, vault, assets);
        mint(sharesReceiver, shares);

        emit Deposit(msg.sender, sharesReceiver, assets, shares);
        accountings.totalAssetsDeposited += assets;
        return shares;
    }

    /**
     * @dev Executes a default, supplying first-loss to cover losses.
     * @param asset Pool liquidity asset
     * @param firstLossVault Vault holding first-loss capital
     * @param loan Address of loan in default
     * @param pool Address of the pool
     */
    function executeDefault(
        address asset,
        address firstLossVault,
        address loan,
        address pool
    ) external {
        ILoan(loan).markDefaulted();

        uint256 firstLossBalance = IERC20(asset).balanceOf(
            address(firstLossVault)
        );

        uint256 outstandingLoanDebt = ILoan(loan).outstandingPrincipal();
        uint256 firstLossRequired = firstLossBalance >= outstandingLoanDebt
            ? outstandingLoanDebt
            : firstLossBalance;

        IVault(firstLossVault).withdrawERC20(asset, firstLossRequired, pool);
        IPool(pool).onLoanDefaulted(loan, firstLossRequired);

        emit LoanDefaulted(loan);
        emit FirstLossApplied(loan, firstLossRequired);
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

    /**
     * @dev Updates a withdraw state based on the current period, moving
     * requested shares to eligible if needed.
     */
    function progressWithdrawState(
        IPoolWithdrawState memory state,
        uint256 currentPeriod
    ) public pure returns (IPoolWithdrawState memory) {
        // If the latest withdrawalState has not been updated for this
        // given request period, we need to move "requested" shares over
        // to be "eligible".
        if (state.latestRequestPeriod < currentPeriod) {
            state.eligibleShares = state.eligibleShares + state.requestedShares;
            state.requestedShares = 0;
        }

        return state;
    }

    /**
     * @dev Calculate the current IPoolWithdrawState based on the existing
     * request state and the current request period.
     */
    function calculateWithdrawStateForRequest(
        IPoolWithdrawState memory state,
        uint256 currentPeriod,
        uint256 requestedShares
    ) public pure returns (IPoolWithdrawState memory updatedState) {
        require(currentPeriod >= 0, "Pool: Invalid request period");

        updatedState = progressWithdrawState(state, currentPeriod);

        // Increment the requested shares count, and ensure the "latestRequestPeriod"
        // is set to the current request period.
        updatedState.requestedShares = state.requestedShares + requestedShares;
        updatedState.latestRequestPeriod = currentPeriod;
    }

    /**
     * @dev Calculate the current IPoolWithdrawState based on the existing
     * request state and the current request period.
     */
    function calculateWithdrawStateForCancellation(
        IPoolWithdrawState memory state,
        uint256 cancelledShares
    ) public pure returns (IPoolWithdrawState memory updatedState) {
        updatedState = state;
        // Decrease the requested, eligible shares count, and ensure the "latestRequestPeriod"
        // is set to the current request period.
        if (updatedState.requestedShares > cancelledShares) {
            updatedState.requestedShares -= cancelledShares;
            cancelledShares = 0;
        } else {
            cancelledShares -= updatedState.requestedShares;
            updatedState.requestedShares = 0;
        }

        if (updatedState.eligibleShares > cancelledShares) {
            updatedState.eligibleShares -= cancelledShares;
            cancelledShares = 0;
        } else {
            cancelledShares -= updatedState.eligibleShares;
            updatedState.eligibleShares = 0;
        }

        // Sanity check that we've cancelled all shares.
        require(cancelledShares == 0, "Pool: Invalid cancelled shares");
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
        return divideCeil(shares * requestFeeBps, 10_000);
    }

    /**
     * @dev Calculate the fee for cancelling a withdrawRequest or a redeemRequest.
     * Per the EIP-4626 spec, this method rounds up.
     */
    function calculateCancellationFee(
        uint256 shares,
        uint256 requestCancellationFeeBps
    ) public pure returns (uint256) {
        return divideCeil(shares * requestCancellationFeeBps, 10_000);
    }

    /**
     * @dev Calculates the Maximum amount of shares that can be requested
     */
    function calculateMaxRedeemRequest(
        IPoolWithdrawState memory state,
        uint256 shareBalance,
        uint256 requestFeeBps
    ) public pure returns (uint256) {
        uint256 sharesRemaining = shareBalance -
            state.requestedShares -
            state.eligibleShares -
            state.redeemableShares;

        return sharesRemaining.mul(10_000).div(requestFeeBps + 10_000);
    }

    /**
     * @dev Calculates the Maximum amount of shares that can be cancelled
     * from the current withdraw request.
     */
    function calculateMaxCancellation(IPoolWithdrawState memory state)
        public
        pure
        returns (uint256)
    {
        return state.requestedShares + state.eligibleShares;
    }

    /**
     * @dev Updates a withdraw state according to assets withdrawn / shares redeemed.
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
