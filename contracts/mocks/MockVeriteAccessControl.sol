// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {VeriteAccessControl} from "../permissioned/VeriteAccessControl.sol";
import "../upgrades/DeployerUUPSUpgradeable.sol";

contract MockVeriteAccessControl is
    VeriteAccessControl,
    DeployerUUPSUpgradeable
{
    function initialize() public initializer {
        __EIP712_init("VerificationRegistry", "1.0");
    }
}
