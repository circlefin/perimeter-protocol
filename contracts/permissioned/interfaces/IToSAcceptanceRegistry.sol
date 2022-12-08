// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title The interface for interacting with Terms of Service Acceptance Registry.
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
     * @dev Records that msg.sender has accepted the TermsOfService.
     */
    function acceptTermsOfService() external;

    /**
     * @dev Returns whether an address has accepted the TermsOfService.
     */
    function hasAccepted(address addr) external view returns (bool);
}
