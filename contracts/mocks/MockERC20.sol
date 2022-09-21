// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {ERC20PresetMinterPauser} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/**
 * @title A Mock ERC20 contract used for testing
 */
contract MockERC20 is ERC20PresetMinterPauser {
    constructor(string memory name, string memory symbol)
        ERC20PresetMinterPauser(name, symbol)
    {}
}
