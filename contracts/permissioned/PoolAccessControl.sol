// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IPoolAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "./interfaces/IToSAcceptanceRegistry.sol";
import "../interfaces/IPool.sol";
import "./VeriteAccessControl.sol";

/**
 * @title The PoolAccessControl contract
 * @dev Implementation of the {IPoolAccessControl} interface.
 *
 * This implementation implements a basic Allow-List of addresses, which can
 * be managed only by the Pool Admin.
 */
contract PoolAccessControl is IPoolAccessControl, VeriteAccessControl {
    /**
     * @dev Reference to the pool
     */
    IPool private _pool;

    /**
     * @dev Reference to the ToS Acceptance Registry
     */
    IToSAcceptanceRegistry private _tosRegistry;

    /**
     * @dev A mapping of addresses to whether they are allowed to lend or borrower in the pool.
     */
    mapping(address => bool) private _allowedParticipants;

    /**
     * @dev Emitted when an address is added from the participant allow list.
     */
    event ParticipantAllowed(address indexed addr);

    /**
     * @dev Emitted when an address is removed from the participant allow list.
     */
    event ParticipantRemoved(address indexed addr);

    /**
     * @dev Modifier that checks that the caller is the pool's admin.
     */
    modifier onlyPoolAdmin() {
        require(msg.sender == _pool.admin(), "CALLER_NOT_ADMIN");
        _;
    }

    /**
     * @dev Modifier to restrict the Verite Access Control logic to pool admins
     */
    modifier onlyVeriteAdmin() override {
        require(msg.sender == _pool.admin(), "CALLER_NOT_ADMIN");
        _;
    }

    /**
     * @dev Modifier to restrict verification to users who have accepted the ToS
     */
    modifier onlyVeriteEligible() override {
        // Ensure the subject has accepted the ToS
        require(_tosRegistry.hasAccepted(msg.sender), "MISSING_TOS_ACCEPTANCE");
        _;
    }

    /**
     * @dev The constructor for the PoolAccessControl contract
     */
    constructor(address pool, address tosAcceptanceRegistry) {
        require(
            tosAcceptanceRegistry != address(0),
            "Pool: invalid ToS registry"
        );

        _pool = IPool(pool);
        _tosRegistry = IToSAcceptanceRegistry(tosAcceptanceRegistry);
    }

    /**
     * @dev Checks if the given address is allowed as a Participant.
     * @inheritdoc IPoolAccessControl
     */
    function isValidParticipant(address addr) external view returns (bool) {
        return _allowedParticipants[addr] || isVerified(addr);
    }

    /**
     * @dev Adds an address to the participant allow list.
     *
     * Emits an {AllowedParticipantListUpdated} event.
     */
    function allowParticipant(address addr) external onlyPoolAdmin {
        require(
            _tosRegistry.hasAccepted(addr),
            "Pool: participant not accepted ToS"
        );
        _allowedParticipants[addr] = true;
        emit ParticipantAllowed(addr);
    }

    /**
     * @dev Removes an address from the participant allow list.
     *
     * Emits an {AllowedParticipantListUpdated} event.
     */
    function removeParticipant(address addr) external onlyPoolAdmin {
        delete _allowedParticipants[addr];
        emit ParticipantRemoved(addr);
    }
}
