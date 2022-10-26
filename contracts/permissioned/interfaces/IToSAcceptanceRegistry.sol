// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

/**
 * @title The interface for interacting with Terms of Service consent.
 */
interface IToSAcceptanceRegistry {
    /**
     * @dev Emitted when someone accepts the ToS.
     */
    event AcceptanceRecorded(address indexed accepter);

    /**
     * @dev Emitted when the Terms of Service is updated.
     */
    event TermsOfServiceUpdated();

    /**
     * @dev Returns the current TermsOfService URL
     */
    function termsOfService() external view returns (string memory);

    /**
     * @dev Updates the TermsOfService.
     */
    function updateTermsOfService(string memory url) external;

    /**
     * @dev Records that msg.sender has consented to the TermsOfService.
     */
    function acceptTermsOfService() external;

    /**
     * @dev Returns whether an address has consented to the TermsOfService.
     */
    function hasAccepted(address addr) external view returns (bool);
}
