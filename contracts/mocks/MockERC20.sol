/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.16;

import {ERC20PresetMinterPauser} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/**
 * @title A Mock ERC20 contract used for testing
 */
contract MockERC20 is ERC20PresetMinterPauser {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20PresetMinterPauser(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
