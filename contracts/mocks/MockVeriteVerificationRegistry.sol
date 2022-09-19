// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../interfaces/IVerificationRegistry.sol";

/**
 * @title A Mock Verite VerificationRegistry contract used for testing
 *
 * This contract exposes the VerificationRegistry isVerified method, but it's
 * internals are not of a real VerificationRegistry, which would store
 * VerificationRecords and perform proper validation of the records. Instead,
 * this contract internals are an allowList, which satisfies the
 * external interface for testing.
 */
contract MockVeriteVerificationRegistry is IVerificationRegistry {
    /**
     * @dev A mapping of addresses to whether they are verified.
     *
     * NOTE: In a real Verite VerificationRegistry contract, this mapping would
     * not exist, but rather it would store a mapping of VerificationRecords.
     *
     * See https://github.com/centrehq/verite/blob/main/packages/contract/contracts/IVerificationRegistry.sol#L49-L56
     * See https://github.com/centrehq/verite/blob/main/packages/contract/contracts/VerificationRegistry.sol#L47-L53
     */
    mapping(address => bool) private _verifiedAddresses;

    /**
     * @inheritdoc IVerificationRegistry
     */
    function isVerified(address addr) external view override returns (bool) {
        return _verifiedAddresses[addr];
    }

    /**
     * @dev Adds or removes an address from the verified list.
     * @param addr The address to add or remove
     */
    function setVerified(address addr, bool allow) external {
        _verifiedAddresses[addr] = allow;
    }
}
