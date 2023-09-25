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

/**
 * @dev Contains state related to withdraw requests, either globally or for a given lender.
 */
struct IPoolWithdrawState {
    uint256 requestedShares; // Number of shares requested in the `latestPeriod`
    uint256 eligibleShares; // Number of shares that are eligibble to be CONSIDERED for withdraw by the snapshot
    uint256 latestRequestPeriod; // Period where this was last updated
    uint256 redeemableShares; // The shares that are currently withdrawable
    uint256 withdrawableAssets; // The assets that are currently withdrawable
    uint256 latestSnapshotPeriod; // window last snapshotted in
}

/**
 * @dev Holds per-snapshot state used to compute a user's redeemable shares and assets.
 */
struct IPoolSnapshotState {
    uint256 redeemableRateRay;
    uint256 sharesRedeemable;
    uint256 fxRateRay;
    uint256 nextSnapshotPeriod; // This serves as a pointer to the next snapshot (set whenever the next snapshot runs).
}

/**
 * @title A Pool's Withdraw controller
 * @dev Holds state related to withdraw requests, and logic for snapshotting the
 * pool's liquidity reserve at regular intervals, earmarking funds for lenders according
 * to their withdrawal requests.
 */
interface IWithdrawController {
    /**
     * @dev Emitted when a lender claims snapshots.
     */
    event SnapshotsClaimed(
        address indexed lender,
        uint256 numberSnapshots,
        uint256 shares,
        uint256 assets
    );

    function withdrawPeriod() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            Balance Views
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns the amount of shares that should be considered interest
     * bearing for a given owner.  This number is their balance, minus their
     * "redeemable" shares.
     */
    function interestBearingBalanceOf(address) external view returns (uint256);

    /**
     * @dev Returns the number of shares that have been requested to be redeemed
     * by the owner as of the current block.
     */
    function requestedBalanceOf(address) external view returns (uint256);

    /**
     * @dev Returns the number of shares that are available to be redeemed by
     * the owner in the current block.
     */
    function totalRequestedBalance() external view returns (uint256);

    /**
     * @dev Returns the number of shares owned by an address that are "vested"
     * enough to be considered for redeeming during the next withdraw period.
     */
    function eligibleBalanceOf(address) external view returns (uint256);

    /**
     * @dev Returns the number of shares overall that are "vested" enough to be
     * considered for redeeming during the next withdraw period.
     */
    function totalEligibleBalance() external view returns (uint256);

    /**
     * @dev Returns the number of shares that are available to be redeemed
     * overall in the current block.
     */
    function totalRedeemableShares() external view returns (uint256);

    /**
     * @dev Returns the number of `assets` that are available to be withdrawn
     * overall in the current block.
     */
    function totalWithdrawableAssets() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            Max Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns the maximum number of `shares` that can be
     * requested to be redeemed from the owner balance with a single
     * `requestRedeem` call in the current block.
     *
     * Note: This is equivalent of EIP-4626 `maxRedeem`
     */
    function maxRedeemRequest(address) external view returns (uint256);

    /**
     * @dev The maximum amount of shares that can be redeemed from the owner
     * balance through a redeem call.
     */
    function maxRedeem(address) external view returns (uint256);

    /**
     * @dev Returns the maximum amount of underlying assets that can be
     * withdrawn from the owner balance with a single withdraw call.
     */
    function maxWithdraw(address) external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            Preview Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Simulate the effects of a redeem request at the current block.
     * Returns the amount of underlying assets that would be requested if this
     * entire redeem request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewRedeem`
     */
    function previewRedeemRequest(uint256) external view returns (uint256);

    /**
     * @dev Returns the amount of fees (shares) that would be required to process
     * a redeem request at this current block.
     *
     */
    function previewRedeemRequestFees(
        uint256 shares
    ) external view returns (uint256 feeShares);

    /**
     * @dev Simulate the effects of a withdrawal request at the current block.
     * Returns the amount of `shares` that would be burned if this entire
     * withdrawal request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewWithdraw`
     */
    function previewWithdrawRequest(uint256) external view returns (uint256);

    /**
     * @dev Returns the amount of fees that would be burned, in shares, to fulfill
     * a withdraw request in this current block.
     */
    function previewWithdrawRequestFees(
        uint256 assets
    ) external view returns (uint256 feeShares);

    /**
     * @dev Simulates the effects of their redeemption at the current block.
     * Per EIP4626, should round DOWN.
     */
    function previewRedeem(address, uint256) external view returns (uint256);

    /**
     * @dev Simulate the effects of their withdrawal at the current block.
     * Per EIP4626, should round UP on the number of shares required for assets.
     */
    function previewWithdraw(address, uint256) external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            Request Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Requests redeeming a specific number of `shares` and `assets` from
     * the pool.
     *
     * NOTE: The pool is responsible for handling any fees, and for providing
     * the proper shares/assets ratio.
     */
    function performRequest(address, uint256) external;

    /*//////////////////////////////////////////////////////////////
                        Cancellation Methods
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns the maximum number of `shares` that can be
     * cancelled from being requested for a redemption.
     *
     * Note: This is equivalent of EIP-4626 `maxRedeem`
     */
    function maxRequestCancellation(address) external view returns (uint256);

    /**
     * @dev Cancels a withdraw request for the owner,
     *
     * NOTE This method does not charge fees, as this should be handled outside
     * of the WithdrawController.
     */
    function performRequestCancellation(address, uint256) external;

    /**
     * @dev Iterates over snapshots, up to a limit, and claims eligible funds earmarked
     * across the snapshots, updating the lenders withdrawal state accordingly.
     */
    function claimSnapshots(
        address lender,
        uint256 limit
    ) external returns (uint256 shares, uint256 assets);

    /**
     * @dev Determines whether a lender is "up to date" with the snapshots.
     */
    function claimRequired(address lender) external view returns (bool);

    /*//////////////////////////////////////////////////////////////
                            Snapshot
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Snapshot the protocol. Performs accounting for withdrawals
     */
    function snapshot(
        uint256 withdrawGate
    )
        external
        returns (
            uint256 period,
            uint256 shares,
            uint256 assets,
            bool periodSnapshotted
        );

    /*//////////////////////////////////////////////////////////////
                            Withdraw / Redeem
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.
     *
     * Per EIP4626, should round DOWN.
     */
    function redeem(address, uint256) external returns (uint256);

    /**
     * @dev Burns shares from owner and send exactly assets token from the vault to receiver.
     * Should round UP for EIP4626.
     */
    function withdraw(address, uint256) external returns (uint256);
}
