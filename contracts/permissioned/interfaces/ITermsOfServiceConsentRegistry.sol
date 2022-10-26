// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The interface for interacting with Terms of Service consent.
 */
interface ITermsOfServiceConsentRegistry {
    /**
     * @dev Emitted when consenter records consent.
     */
    event ConsentRecorded(address indexed consenter);

    /**
     * @dev Emitted when the Terms of Service is updated.
     */
    event TermsOfServiceUpdated();

    /**
     * @dev Returns the current ToS URL
     */
    function termsOfService() external view returns (string memory);

    /**
     * @dev Returns the block timestamp at which the ToS url was updated
     */
    function updateTermsOfService(string memory url) external;

    /**
     * @dev Records that msg.sender has consented to ToS.
     */
    function recordConsent() external;

    /**
     * @dev Records that msg.sender has consented to ToS.
     */
    function hasConsented(address addr) external view returns (bool);
}
