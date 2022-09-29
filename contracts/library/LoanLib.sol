// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "../interfaces/ILoan.sol";
import "../CollateralVault.sol";

library LoanLib {
    using SafeERC20 for IERC20;

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedCollateral(address asset, uint256 amount);

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedNonFungibleCollateral(address asset, uint256 tokenId);

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
     * @dev Withdraw ERC20 collateral
     */
    function withdrawFungibleCollateral(
        CollateralVault collateralVault,
        ILoanLifeCycleState state,
        address[] storage collateral
    ) external {
        for (uint256 i = 0; i < collateral.length; i++) {
            address addr = collateral[i];
            collateralVault.withdraw(
                addr,
                IERC20(addr).balanceOf(address(collateralVault)),
                msg.sender
            );
        }

        for (uint256 i = 0; i < collateral.length; i++) {
            collateral.pop();
        }
    }

    /**
     * @dev Withdraw ERC721 collateral
     */
    function withdrawNonFungibleCollateral(
        CollateralVault collateralVault,
        ILoanLifeCycleState state,
        ILoanNonFungibleCollateral[] storage collateral
    ) external {
        for (uint256 i = 0; i < collateral.length; i++) {
            ILoanNonFungibleCollateral memory c = collateral[i];
            collateralVault.withdrawERC721(c.asset, c.tokenId, msg.sender);
        }

        for (uint256 i = 0; i < collateral.length; i++) {
            collateral.pop();
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
}
