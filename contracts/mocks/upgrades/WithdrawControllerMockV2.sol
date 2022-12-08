// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../../controllers/WithdrawController.sol";
import "./MockUpgrade.sol";

/**
 * @dev Simulated new ServiceConfiguration implementation
 */
contract WithdrawControllerMockV2 is WithdrawController, MockUpgrade {

}
