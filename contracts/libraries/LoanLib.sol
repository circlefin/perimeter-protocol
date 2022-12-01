// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/ILoan.sol";
import "../interfaces/IServiceConfiguration.sol";
import "../CollateralVault.sol";
import "../FundingVault.sol";

library LoanLib {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 constant RAY = 10**27;

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
        CollateralVault collateralVault,
        address[] memory collateralToWithdraw
    ) external {
        for (uint256 i = 0; i < collateralToWithdraw.length; i++) {
            address asset = collateralToWithdraw[i];

            // Perform transfer
            uint256 amount = IERC20(asset).balanceOf(address(collateralVault));
            collateralVault.withdraw(asset, amount, msg.sender);
            emit WithdrewCollateral(asset, amount);
        }
    }

    /**
     * @dev Withdraw ERC721 collateral
     */
    function withdrawNonFungibleCollateral(
        CollateralVault collateralVault,
        ILoanNonFungibleCollateral[] memory collateralToWithdraw
    ) external {
        for (uint256 i = 0; i < collateralToWithdraw.length; i++) {
            ILoanNonFungibleCollateral memory wc = collateralToWithdraw[i];
            address asset = wc.asset;
            uint256 tokenId = wc.tokenId;

            collateralVault.withdrawERC721(asset, tokenId, msg.sender);
            emit WithdrewNonFungibleCollateral(asset, tokenId);
        }
    }

    /**
     * Fund a loan
     */
    function fundLoan(
        address liquidityAsset,
        FundingVault fundingVault,
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
     * Drawdown a loan
     */
    function drawdown(
        uint256 amount,
        FundingVault fundingVault,
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

        IERC20 asset = fundingVault.asset();

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
        fundingVault.withdraw(amount, receiver);
        emit LoanDrawnDown(address(asset), amount);
        return (ILoanLifeCycleState.Active, paymentDueDate);
    }

    /**
     * Paydown principal
     */
    function paydownPrincipal(
        address asset,
        uint256 amount,
        FundingVault fundingVault
    ) external {
        IERC20(asset).safeTransferFrom(
            msg.sender,
            address(fundingVault),
            amount
        );
        emit LoanPrincipalPaid(asset, amount, address(fundingVault));
    }

    /**
     * Make a payment
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
     * Make a payment
     */
    function returnCanceledLoanPrincipal(
        FundingVault fundingVault,
        address pool,
        uint256 amount
    ) public {
        fundingVault.withdraw(amount, pool);
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

    function previewOriginationFee(ILoanSettings calldata settings)
        public
        pure
        returns (uint256)
    {
        uint256 numOfPayments = settings.duration.div(settings.paymentPeriod);

        return
            settings
                .principal
                .mul(settings.originationBps)
                .mul(settings.duration.mul(RAY).div(360))
                .div(numOfPayments)
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
        uint256 paymentDueDate
    ) public pure returns (ILoanFees memory) {
        ILoanFees memory fees;
        fees.payment = payment;
        fees.firstLossFee = previewFirstLossFee(payment, firstLoss);
        fees.serviceFee = previewServiceFee(payment, serviceFeeBps);
        fees.originationFee = previewOriginationFee(settings);
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
        uint256 firstLoss,
        address poolAdmin,
        uint256 serviceFeeBps,
        uint256 originationFee
    ) public {
        if (firstLoss > 0) {
            IERC20(asset).safeTransferFrom(
                msg.sender,
                firstLossVault,
                firstLoss
            );
        }
        if (serviceFeeBps > 0) {
            IERC20(asset).safeTransferFrom(
                msg.sender,
                poolAdmin,
                serviceFeeBps
            );
        }
        if (originationFee > 0) {
            IERC20(asset).safeTransferFrom(
                msg.sender,
                poolAdmin,
                originationFee
            );
        }
    }
}
