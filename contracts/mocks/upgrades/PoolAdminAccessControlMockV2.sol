// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../permissioned/PoolAdminAccessControl.sol";
import "./MockUpgrade.sol";

contract PoolAdminAccessControlMockV2 is PoolAdminAccessControl, MockUpgrade {}
