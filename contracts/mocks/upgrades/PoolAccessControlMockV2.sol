// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import "../../permissioned/PoolAccessControl.sol";
import "./MockUpgrade.sol";

contract PoolAccessControlMockV2 is PoolAccessControl, MockUpgrade {}
