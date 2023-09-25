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

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title Interface that exposes methods to request withdraws / redeems.
 * @dev Terminology and design informed to complement ERC4626.
 */
interface IRequestWithdrawable {
    /**
     * @dev Returns the maximum number of `shares` that can be
     * requested to be redeemed from the owner balance with a single
     * `requestRedeem` call in the current block.
     *
     * Note: This is equivalent of EIP-4626 `maxRedeem`
     */
    function maxRedeemRequest(address owner)
        external
        view
        returns (uint256 maxShares);

    /**
     * @dev Returns the maximum amount of underlying `assets` that can be
     * requested to be withdrawn from the owner balance with a single
     * `requestWithdraw` call in the current block.
     *
     * Note: This is equivalent of EIP-4626 `maxWithdraw`
     */
    function maxWithdrawRequest(address owner)
        external
        view
        returns (uint256 maxAssets);

    /**
     * @dev Simulate the effects of a redeem request at the current block.
     * Returns the amount of underlying assets that would be requested if this
     * entire redeem request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewRedeem`
     */
    function previewRedeemRequest(uint256 shares)
        external
        view
        returns (uint256 assets);

    /**
     * @dev Returns the amount of fees (shares) that would be required to process
     * a redeem request at this current block.
     *
     */
    function previewRedeemRequestFees(uint256 shares)
        external
        view
        returns (uint256 feeShares);

    /**
     * @dev Simulate the effects of a withdrawal request at the current block.
     * Returns the amount of `shares` that would be burned if this entire
     * withdrawal request were to be processed at the current block.
     *
     * Note: This is equivalent of EIP-4626 `previewWithdraw`
     */
    function previewWithdrawRequest(uint256 assets)
        external
        view
        returns (uint256 shares);

    /**
     * @dev Returns the amount of fees that would be burned, in shares, to fulfill
     * a withdraw request in this current block.
     */
    function previewWithdrawRequestFees(uint256 assets)
        external
        view
        returns (uint256 feeShares);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestRedeem(uint256 shares) external returns (uint256 assets);

    /**
     * @dev Submits a withdrawal request, incurring a fee.
     */
    function requestWithdraw(uint256 assets) external returns (uint256 shares);

    /**
     * @dev Returns the maximum number of `shares` that can be
     * cancelled from being requested for a redemption.
     *
     * Note: This is equivalent of EIP-4626 `maxRedeem`
     */
    function maxRequestCancellation(address owner)
        external
        view
        returns (uint256 maxShares);

    /**
     * @dev Cancels a redeem request for a specific number of `shares` from
     * owner and returns an estimated amnount of underlying that equates to
     * this number of shares.
     *
     * Emits a {WithdrawRequestCancelled} event.
     */
    function cancelRedeemRequest(uint256 shares)
        external
        returns (uint256 assets);

    /**
     * @dev Cancels a withdraw request for a specific values of `assets` from
     * owner and returns an estimated number of shares that equates to
     * this number of assets.
     *
     * Emits a {WithdrawRequestCancelled} event.
     */
    function cancelWithdrawRequest(uint256 assets)
        external
        returns (uint256 shares);
}
