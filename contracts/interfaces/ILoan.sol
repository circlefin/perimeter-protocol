// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The protocol Loan
 */
enum ILoanLifeCycleState {
    Requested,
    Collateralized,
    Canceled,
    Defaulted,
    Funded,
    Matured
}

interface ILoan {
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

    function postFungibleCollateral(address asset, uint256 amount)
        external
        returns (ILoanLifeCycleState);

    function postNonFungibleCollateral(address asset, uint256 tokenId)
        external
        returns (ILoanLifeCycleState);

    function fund() external returns (ILoanLifeCycleState);
}
