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
