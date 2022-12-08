// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../../permissioned/ToSAcceptanceRegistry.sol";
import "./MockUpgrade.sol";

/**
 * @dev Simulated new ToSAcceptanceRegistry implementation
 */
contract ToSAcceptanceRegistryMockV2 is ToSAcceptanceRegistry, MockUpgrade {

}
