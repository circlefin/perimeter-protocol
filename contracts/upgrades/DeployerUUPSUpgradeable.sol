// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IServiceConfiguration.sol";

/**
 * @title Base contract for UUPS upgradeable contracts.
 * @dev Ensures only the protocol upgrader can perform the upgrade.
 */
abstract contract DeployerUUPSUpgradeable is Initializable, UUPSUpgradeable {
    /**
     * @dev Address of the protocol service configuration
     */
    IServiceConfiguration internal _serviceConfiguration;

    /**
     * @dev Modifier that requires that the sender is registered as a protocol deployer.
     */
    modifier onlyDeployer() {
        require(
            _serviceConfiguration.isDeployer(msg.sender),
            "Upgrade: unauthorized"
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @inheritdoc UUPSUpgradeable
     */
    function _authorizeUpgrade(address) internal override onlyDeployer {}
}
