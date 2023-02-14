// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../libraries/PoolLib.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IPool.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title PoolLibTestWrapper
 * @dev Wrapper around PoolLib to facilitate testing.
 */
contract PoolLibTestWrapper is ERC20("PoolLibTest", "PLT") {
    using EnumerableSet for EnumerableSet.AddressSet;

    address public asset;
    EnumerableSet.AddressSet private _activeLoans;
    IPoolAccountings private _accountings;

    event LifeCycleStateTransition(IPoolLifeCycleState state);
    event FirstLossDeposited(
        address indexed caller,
        address indexed supplier,
        uint256 amount
    );
    event FirstLossWithdrawn(
        address indexed caller,
        address indexed receiver,
        uint256 amount
    );
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    constructor(address _asset) {
        asset = _asset;
    }

    function executeFirstLossDeposit(
        address liquidityAsset,
        address spender,
        uint256 amount,
        address firstLossVault,
        IPoolLifeCycleState currentState,
        uint256 minFirstLossRequired
    ) external {
        PoolLib.executeFirstLossDeposit(
            liquidityAsset,
            spender,
            amount,
            firstLossVault,
            currentState,
            minFirstLossRequired
        );
    }

    function executeFirstLossWithdraw(
        uint256 amount,
        address withdrawReceiver,
        address firstLossVault
    ) external returns (uint256) {
        return
            PoolLib.executeFirstLossWithdraw(
                amount,
                withdrawReceiver,
                firstLossVault
            );
    }

    function calculateConversion(
        uint256 input,
        uint256 numerator,
        uint256 denominator,
        bool roundUp
    ) public pure returns (uint256) {
        return
            PoolLib.calculateConversion(input, numerator, denominator, roundUp);
    }

    function calculateSharesFromAssets(
        uint256 assets,
        uint256 totalShares,
        uint256 totalAssets,
        bool roundUp
    ) external pure returns (uint256) {
        return
            PoolLib.calculateSharesFromAssets(
                assets,
                totalShares,
                totalAssets,
                roundUp
            );
    }

    function calculateAssetsFromShares(
        uint256 shares,
        uint256 totalAssets,
        uint256 totalShares,
        bool roundUp
    ) external pure returns (uint256) {
        return
            PoolLib.calculateAssetsFromShares(
                shares,
                totalAssets,
                totalShares,
                roundUp
            );
    }

    function calculateTotalAssets(
        address asset_,
        address vault,
        uint256 outstandingLoanPrincipals
    ) external view returns (uint256) {
        return
            PoolLib.calculateTotalAssets(
                asset_,
                vault,
                outstandingLoanPrincipals
            );
    }

    function calculateTotalAvailableAssets(
        address asset_,
        address vault,
        uint256 outstandingLoanPrincipals,
        uint256 withdrawableAssets
    ) external view returns (uint256) {
        return
            PoolLib.calculateTotalAvailableAssets(
                asset_,
                vault,
                outstandingLoanPrincipals,
                withdrawableAssets
            );
    }

    function calculateTotalAvailableShares(
        address vault,
        uint256 redeemableShares
    ) external view returns (uint256) {
        return PoolLib.calculateTotalAvailableShares(vault, redeemableShares);
    }

    function calculateMaxDeposit(
        IPoolLifeCycleState poolLifeCycleState,
        uint256 poolMaxCapacity,
        uint256 totalAvailableAssets
    ) external pure returns (uint256) {
        return
            PoolLib.calculateMaxDeposit(
                poolLifeCycleState,
                poolMaxCapacity,
                totalAvailableAssets
            );
    }

    function setMockActiveLoans(address[] memory loans) public {
        // Clear out prior entries
        for (uint256 i = 0; i < _activeLoans.length(); i++) {
            _activeLoans.remove(_activeLoans.at(i));
        }
        // Add new loans
        for (uint256 i = 0; i < loans.length; i++) {
            _activeLoans.add(loans[i]);
        }
    }

    function calculateExpectedInterestFromMocks()
        public
        view
        returns (uint256 expectedInterest)
    {
        return PoolLib.calculateExpectedInterest(_activeLoans);
    }

    function executeDeposit(
        address asset_,
        address vault,
        address sharesReceiver,
        uint256 assets,
        uint256 shares,
        uint256 maxDeposit
    ) external returns (uint256) {
        return
            PoolLib.executeDeposit(
                asset_,
                vault,
                sharesReceiver,
                assets,
                shares,
                maxDeposit,
                _mint,
                _accountings
            );
    }

    function isPoolLoan(
        address loan,
        address serviceConfiguration,
        address pool
    ) public view returns (bool) {
        return PoolLib.isPoolLoan(loan, serviceConfiguration, pool);
    }

    function calculateCurrentWithdrawPeriod(
        uint256 currentTimestamp,
        uint256 activatedAt,
        uint256 withdrawalWindowDuration
    ) public pure returns (uint256) {
        return
            PoolLib.calculateCurrentWithdrawPeriod(
                currentTimestamp,
                activatedAt,
                withdrawalWindowDuration
            );
    }

    function calculateWithdrawStateForRequest(
        IPoolWithdrawState memory state,
        uint256 currentPeriod,
        uint256 requestedShares
    ) public pure returns (IPoolWithdrawState memory) {
        return
            PoolLib.calculateWithdrawStateForRequest(
                state,
                currentPeriod,
                requestedShares
            );
    }

    function calculateWithdrawStateForCancellation(
        IPoolWithdrawState memory state,
        uint256 cancelledShares
    ) public pure returns (IPoolWithdrawState memory) {
        return
            PoolLib.calculateWithdrawStateForCancellation(
                state,
                cancelledShares
            );
    }

    function calculateRequestFee(uint256 shares, uint256 requestFeeBps)
        external
        pure
        returns (uint256)
    {
        return PoolLib.calculateRequestFee(shares, requestFeeBps);
    }

    function calculateCancellationFee(
        uint256 shares,
        uint256 requestCancellationFeeBps
    ) external pure returns (uint256) {
        return
            PoolLib.calculateCancellationFee(shares, requestCancellationFeeBps);
    }

    function calculateMaxRedeemRequest(
        IPoolWithdrawState memory state,
        uint256 shareBalance,
        uint256 requestFeeBps
    ) public pure returns (uint256) {
        return
            PoolLib.calculateMaxRedeemRequest(
                state,
                shareBalance,
                requestFeeBps
            );
    }

    function calculateMaxCancellation(IPoolWithdrawState memory state)
        public
        pure
        returns (uint256)
    {
        return PoolLib.calculateMaxCancellation(state);
    }
}
