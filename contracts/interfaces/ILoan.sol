// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The protocol Loan
 */
interface ILoan {
    enum ILoanLifeCycleState {
        Requested,
        Collateralized,
        Canceled,
        Defaulted,
        Funded,
        Matured
    }

    struct ILoanFungibleCollateral {
        address asset;
        uint256 amount;
    }

    struct ILoanNonFungibleCollateral {
        address asset;
        uint256 _tokenId;
        bytes data;
    }
}
