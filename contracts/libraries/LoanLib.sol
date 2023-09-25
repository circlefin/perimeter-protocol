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

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/ILoan.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../interfaces/IVault.sol";

library LoanLib {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant RAY = 10**27;

    /**
     * @dev Emitted when loan is funded.
     */
    event LoanFunded(address asset, uint256 amount);

    /**
     * @dev Emitted when the loan is drawn down.
     */
    event LoanDrawnDown(address asset, uint256 amount);

    /**
     * @dev Emitted when loan principal is repaid ahead of schedule.
     */
    event LoanPrincipalPaid(
        address asset,
        uint256 amount,
        address fundingVault
    );

    /**
     * @dev Emitted when a loan payment is made.
     */
    event LoanPaymentMade(address pool, address liquidityAsset, uint256 amount);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedCollateral(address asset, uint256 amount);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedNonFungibleCollateral(address asset, uint256 tokenId);

    /**
     * @dev Emitted when collateral is withdrawn from the loan.
     */
    event WithdrewCollateral(address asset, uint256 amount);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event WithdrewNonFungibleCollateral(address asset, uint256 tokenId);

    /**
     * @dev See ILoan
     */
    event CanceledLoanPrincipalReturned(
        address indexed pool,
        uint256 principal
    );

    /**
     * @dev Validate Loan constructor arguments
     */
    function validateLoan(
        IServiceConfiguration config,
        IPool pool,
        uint256 duration,
        uint256 paymentPeriod,
        uint256 principal,
        address liquidityAsset
    ) external view {
        require(duration > 0, "LoanLib: Duration cannot be zero");
        require(paymentPeriod > 0, "LoanLib: Payment period cannot be zero");
        require(
            duration.mod(paymentPeriod) == 0,
            "LoanLib: Duration not evenly divisible"
        );
        require(principal > 0, "LoanLib: Principal cannot be zero");

        require(
            config.isLiquidityAsset(liquidityAsset),
            "LoanLib: Liquidity asset not allowed"
        );
        require(
            pool.asset() == liquidityAsset,
            "LoanLib: Not allowed asset for pool"
        );
    }

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral(
        address collateralVault,
        address asset,
        uint256 amount,
        ILoanLifeCycleState state,
        address[] storage collateral
    ) external returns (ILoanLifeCycleState) {
        // Transfer collateral
        IERC20(asset).safeTransferFrom(msg.sender, collateralVault, amount);

        // Keep track of collateral
        bool found = false;
        for (uint256 i = 0; i < collateral.length; i++) {
            if (collateral[i] == asset) {
                found = true;
                break;
            }
        }
        if (!found) {
            collateral.push(asset);
        }

        // Emit event
        emit PostedCollateral(asset, amount);

        // Determine state
        if (state == ILoanLifeCycleState.Requested) {
            return ILoanLifeCycleState.Collateralized;
        } else {
            return state;
        }
    }

    /**
     * @dev Post ERC721 tokens as collateral
     */
    function postNonFungibleCollateral(
        address collateralVault,
        address asset,
        uint256 tokenId,
        ILoanLifeCycleState state,
        ILoanNonFungibleCollateral[] storage collateral
    ) external returns (ILoanLifeCycleState) {
        IERC721(asset).safeTransferFrom(msg.sender, collateralVault, tokenId);
        collateral.push(ILoanNonFungibleCollateral(asset, tokenId));
        emit PostedNonFungibleCollateral(asset, tokenId);
        if (state == ILoanLifeCycleState.Requested) {
            return ILoanLifeCycleState.Collateralized;
        } else {
            return state;
        }
    }

    /**
     * @dev Withdraw ERC20 collateral
     */
    function withdrawFungibleCollateral(
        IVault collateralVault,
        address[] memory collateralToWithdraw,
        address recipient
    ) external {
        for (uint256 i = 0; i < collateralToWithdraw.length; i++) {
            address asset = collateralToWithdraw[i];

            // Perform transfer
            uint256 amount = IERC20(asset).balanceOf(address(collateralVault));
            collateralVault.withdrawERC20(asset, amount, recipient);
            emit WithdrewCollateral(asset, amount);
        }
    }

    /**
     * @dev Withdraw ERC721 collateral
     */
    function withdrawNonFungibleCollateral(
        IVault collateralVault,
        ILoanNonFungibleCollateral[] memory collateralToWithdraw,
        address recipient
    ) external {
        for (uint256 i = 0; i < collateralToWithdraw.length; i++) {
            ILoanNonFungibleCollateral memory wc = collateralToWithdraw[i];
            address asset = wc.asset;
            uint256 tokenId = wc.tokenId;

            collateralVault.withdrawERC721(asset, tokenId, recipient);
            emit WithdrewNonFungibleCollateral(asset, tokenId);
        }
    }

    /**
     * @dev Called on loan fundings, pulls funds from the pool into the
     * loan's funding vault.
     */
    function fundLoan(
        address liquidityAsset,
        IVault fundingVault,
        uint256 amount
    ) public returns (ILoanLifeCycleState) {
        IERC20(liquidityAsset).safeTransferFrom(
            msg.sender,
            address(fundingVault),
            amount
        );
        emit LoanFunded(liquidityAsset, amount);
        return ILoanLifeCycleState.Funded;
    }

    /**
     * @dev Pulls funds from the loan's funding vault and transfers
     * to the borrower.
     */
    function drawdown(
        uint256 amount,
        address asset,
        IVault fundingVault,
        address receiver,
        uint256 paymentDueDate,
        ILoanSettings storage settings,
        ILoanLifeCycleState state
    ) public returns (ILoanLifeCycleState, uint256) {
        // First drawdown kicks off the payment schedule
        if (paymentDueDate == 0) {
            paymentDueDate =
                block.timestamp +
                (settings.paymentPeriod * 1 days);
        }

        // Fixed term loans require the borrower to drawdown the full amount
        if (settings.loanType == ILoanType.Fixed) {
            require(
                state == ILoanLifeCycleState.Funded,
                "LoanLib: invalid state"
            );
            require(
                amount == IERC20(asset).balanceOf(address(fundingVault)),
                "LoanLib: invalid amount"
            );
        } else {
            // Open Term
            require(
                state == ILoanLifeCycleState.Funded ||
                    state == ILoanLifeCycleState.Active,
                "LoanLib: invalid state"
            );
        }
        fundingVault.withdrawERC20(asset, amount, receiver);
        emit LoanDrawnDown(address(asset), amount);
        return (ILoanLifeCycleState.Active, paymentDueDate);
    }

    /**
     * @dev Allows partial re-payment of loan principal, moving funds from the
     * borrower to the loan's funding vault.
     */
    function paydownPrincipal(
        address asset,
        uint256 amount,
        IVault fundingVault
    ) external {
        IERC20(asset).safeTransferFrom(
            msg.sender,
            address(fundingVault),
            amount
        );
        emit LoanPrincipalPaid(asset, amount, address(fundingVault));
    }

    /**
     * @dev Transfers funds from the borrower back to the pool.
     */
    function completePayment(
        address liquidityAsset,
        address pool,
        uint256 amount
    ) public {
        IERC20(liquidityAsset).safeTransferFrom(msg.sender, pool, amount);
        emit LoanPaymentMade(pool, liquidityAsset, amount);
    }

    /**
     * @dev Withdraws from funding vault and returns capital to the pool.
     */
    function returnCanceledLoanPrincipal(
        IVault fundingVault,
        address asset,
        address pool,
        uint256 amount
    ) public {
        fundingVault.withdrawERC20(asset, amount, pool);
        IPool(pool).onLoanPrincipalReturned(amount);
        emit CanceledLoanPrincipalReturned(pool, amount);
    }

    function previewFirstLossFee(uint256 payment, uint256 firstLossFeeBps)
        public
        pure
        returns (uint256)
    {
        return RAY.mul(payment).mul(firstLossFeeBps).div(100_00).div(RAY);
    }

    function previewServiceFee(uint256 payment, uint256 serviceFeeBps)
        public
        pure
        returns (uint256)
    {
        return RAY.mul(payment).mul(serviceFeeBps).div(100_00).div(RAY);
    }

    function previewOriginationFee(
        ILoanSettings calldata settings,
        uint256 scalingValue
    ) public pure returns (uint256) {
        return
            settings
                .principal
                .mul(settings.originationBps)
                .mul(settings.duration.mul(scalingValue).div(360))
                .div(settings.duration.div(settings.paymentPeriod))
                .div(RAY)
                .div(10000);
    }

    function previewLatePaymentFee(
        ILoanSettings calldata settings,
        uint256 blockTimestamp,
        uint256 paymentDueDate
    ) public pure returns (uint256) {
        if (blockTimestamp > paymentDueDate) {
            return settings.latePayment;
        }

        return 0;
    }

    /**
     * @dev Calculate the fees for a given interest payment.
     */
    function previewFees(
        ILoanSettings calldata settings,
        uint256 payment,
        uint256 firstLoss,
        uint256 serviceFeeBps,
        uint256 blockTimestamp,
        uint256 paymentDueDate,
        uint256 scalingValue
    ) public pure returns (ILoanFees memory) {
        // If there is a scaling value
        payment = payment.mul(scalingValue).div(RAY);
        ILoanFees memory fees;
        fees.payment = payment;
        fees.firstLossFee = previewFirstLossFee(payment, firstLoss);
        fees.serviceFee = previewServiceFee(payment, serviceFeeBps);
        fees.originationFee = previewOriginationFee(settings, scalingValue);
        fees.latePaymentFee = previewLatePaymentFee(
            settings,
            blockTimestamp,
            paymentDueDate
        );
        fees.interestPayment = payment - fees.serviceFee - fees.firstLossFee;

        return fees;
    }

    function payFees(
        address asset,
        address firstLossVault,
        address feeVault,
        ILoanFees calldata fees
    ) public {
        if (fees.firstLossFee > 0 || fees.latePaymentFee > 0) {
            IERC20(asset).safeTransferFrom(
                msg.sender,
                firstLossVault,
                fees.firstLossFee + fees.latePaymentFee
            );
        }

        // The FeeVault holds the balance of fees intended for the PoolAdmin.
        // This include both the service fee and origiantion fees.
        uint256 feeVaultAmount = fees.serviceFee + fees.originationFee;
        if (feeVaultAmount > 0) {
            IERC20(asset).safeTransferFrom(
                msg.sender,
                feeVault,
                feeVaultAmount
            );
        }
    }
}
