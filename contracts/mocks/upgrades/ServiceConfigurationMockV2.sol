// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../../ServiceConfiguration.sol";
import "./MockUpgrade.sol";

/**
 * @dev Simulated new ServiceConfiguration implementation
 */
contract ServiceConfigurationMockV2 is ServiceConfiguration, MockUpgrade {

}
