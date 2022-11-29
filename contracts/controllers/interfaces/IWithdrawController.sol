// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @dev contains withdraw request information
 */
struct IPoolWithdrawState {
    uint256 requestedShares; // Number of shares requested in the `latestPeriod`
    uint256 eligibleShares; // Number of shares that are eligibble to be CONSIDERED for withdraw by the crank
    uint256 latestRequestPeriod; // Period where this was last updated
    uint256 redeemableShares; // The shares that are currently withdrawable
    uint256 withdrawableAssets; // The assets that are currently withdrawable
    uint256 latestCrankPeriod; // window last cranked in
    uint256 crankOffsetPeriod; // At the time of request, this is set to the last successful crank.
}

/**
 * @dev Holds per-snapshot state used to compute a user's redeemable shares and assets.
 */
struct IPoolSnapshotState {
    uint256 aggregationSumRay;
    uint256 aggregationSumFxRay;
    uint256 aggregationDifferenceRay;
}

/**
 * @title A Pool's Withdraw controller
 */
interface IWithdrawController {
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
     * @dev Simulate the effects of a withdrawal request at the current block.
     * Returns the amount of `shares` that would be burned if this entire
     * withdrawal request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewWithdraw`
     */
    function previewWithdrawRequest(uint256) external view returns (uint256);

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

    /*//////////////////////////////////////////////////////////////
                            Crank
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Crank the protocol. Performs accounting for withdrawals
     */
    function crank(uint256 withdrawGate)
        external
        returns (
            uint256 period,
            uint256 shares,
            uint256 assets,
            bool periodCranked
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
