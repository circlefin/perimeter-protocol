// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../Vault.sol";
import "./MockUpgrade.sol";

/**
 * @dev Simulated new Vault implementation
 */
contract VaultMockV2 is Vault, MockUpgrade {

}
