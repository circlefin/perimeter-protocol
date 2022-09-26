// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../interfaces/IPool.sol";

/**
 * @title The PoolAccessControl contract
 * @dev Implementation of the {IPoolAccessControl} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the Pool Manager.
 */
contract PoolAccessControl is IPoolAccessControl {
    /**
     * @dev Reference to the pool
     */
    IPool private _pool;

    /**
     * @dev Reference to the PermissionedServiceConfiguration contract
     */
    IPermissionedServiceConfiguration private _serviceConfiguration;

    /**
     * @dev A mapping of addresses to whether they are allowed as a Lender
     */
    mapping(address => bool) private _allowedLenders;

    /**
     * @dev Emitted when an address is added or removed from the lender allow list.
     */
    event AllowedLenderListUpdated(address indexed addr, bool isAllowed);

    /**
     * @dev Modifier that checks that the caller is the pool's manager.
     */
    modifier onlyManagerOfPool() {
        require(msg.sender == _pool.manager(), "Pool: caller is not manager");
        _;
    }

    /**
     * The constructor for the PoolAccessControl contract
     */
    constructor(address serviceConfiguration, IPool pool) {
        _serviceConfiguration = IPermissionedServiceConfiguration(
            serviceConfiguration
        );
        _pool = pool;
    }

    /**
     * @dev Checks if the given address is allowed as a Lender.
     * @inheritdoc IPoolAccessControl
     */
    function isValidLender(address addr) external view returns (bool) {
        return _allowedLenders[addr];
    }

    /**
     * @dev Adds an address to the lender allow list.
     *
     * Emits an {AllowedLenderListUpdated} event.
     */
    function allowLender(address addr) external onlyManagerOfPool {
        _allowedLenders[addr] = true;

        emit AllowedLenderListUpdated(addr, true);
    }

    /**
     * @dev Removes an address from the lender allow list.
     *
     * Emits an {AllowedLenderListUpdated} event.
     */
    function removeLender(address addr) external onlyManagerOfPool {
        delete _allowedLenders[addr];

        emit AllowedLenderListUpdated(addr, false);
    }
}
