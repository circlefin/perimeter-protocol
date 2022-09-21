// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolPermission.sol";

/**
 * @title The PoolPermission contract
 * @dev Implementation of the {IPoolPermission} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the contract owner.
 */
contract PoolPermission is IPoolPermission {
    /**
     * @dev A mapping of addresses to whether they are allowed as a Lender
     */
    mapping(address => bool) private _allowedLenders;

    /**
     * @dev A mapping of addresses to whether they are allowed as a Borrowers
     */
    mapping(address => bool) private _allowedBorrowers;

    /**
     * @dev Emitted when an address is added or removed from the lender allow list.
     */
    event AllowedLenderListUpdated(address indexed addr, bool isAllowed);

    /**
     * @dev Emitted when an address is added or removed from the borrower allow list.
     */
    event AllowedBorrowerListUpdated(address indexed addr, bool isAllowed);

    /**
     *
     */
    modifier onlyPoolManager() {
        _;
    }

    /**
     * @dev Checks if the given address is allowed as a Lender.
     * @inheritdoc IPoolPermission
     */
    function isValidLender(address addr) external view returns (bool) {
        return _allowedLenders[addr];
    }

    /**
     * @dev Checks if the given address is allowed as a Borrower.
     * @inheritdoc IPoolPermission
     */
    function isValidBorrower(address addr) external view returns (bool) {
        return _allowedBorrowers[addr];
    }

    function allowLender(address addr) external onlyPoolManager {
        _allowedLenders[addr] = true;

        emit AllowedLenderListUpdated(addr, true);
    }

    function removeLender(address addr) external onlyPoolManager {
        delete _allowedLenders[addr];

        emit AllowedLenderListUpdated(addr, false);
    }

    function allowBorrower(address addr) external onlyPoolManager {
        _allowedBorrowers[addr] = true;

        emit AllowedBorrowerListUpdated(addr, true);
    }

    function removeBorrower(address addr) external onlyPoolManager {
        delete _allowedBorrowers[addr];

        emit AllowedBorrowerListUpdated(addr, false);
    }
}
