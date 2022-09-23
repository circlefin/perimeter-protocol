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

    function state() external view returns (ILoanLifeCycleState);

    function borrower() external returns (address);

    function pool() external view returns (address);

    function cancelRequested() external returns (ILoanLifeCycleState);

    function cancelCollateralized() external returns (ILoanLifeCycleState);

    function postFungibleCollateral() external returns (ILoanLifeCycleState);

    function postNonFungibleCollateral() external returns (ILoanLifeCycleState);

    function fund() external returns (ILoanLifeCycleState);
}
