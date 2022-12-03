// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IServiceConfiguration.sol";

/**
 * @title DeployerUpgradeable
 * @dev Base upgradeable contract that ensures only the protocol Deployer can deploy
 * upgrades.
 */
abstract contract DeployerUUPSUpgradeable is Initializable, UUPSUpgradeable {
    address internal _serviceConfiguration;

    modifier onlyDeployer() {
        require(
            msg.sender != address(0) &&
                IServiceConfiguration(_serviceConfiguration).isDeployer(
                    msg.sender
                ),
            "Upgrade: unauthorized"
        );
        _;
    }

    /**
     * @inheritdoc UUPSUpgradeable
     */
    function _authorizeUpgrade(address) internal override onlyDeployer {}
}
