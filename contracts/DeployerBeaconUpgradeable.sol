// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./interfaces/IServiceConfigurable.sol";

/**
 * @title DeployerUUPSUpDeployerBeaconUpgradeablegradeable
 * @dev Base upgradeable contract that ensures only the protocol Deployer can deploy
 * upgrades. Uses UUPS pattern.
 */
abstract contract DeployerBeaconUpgradeable is
    IServiceConfigurable,
    Initializable,
    UUPSUpgradeable
{
    /**
     * @dev Modifier that requires that the sender is registered as a protocol deployer.
     */
    modifier onlyDeployer() {
        require(
            msg.sender != address(0) &&
                IServiceConfiguration(this.serviceConfiguration()).isDeployer(
                    msg.sender
                ),
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