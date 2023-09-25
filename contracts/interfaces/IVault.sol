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

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title Interface for the Vault.
 * @dev Vaults simply hold a balance, and allow withdrawals by the Vault's owner.
 */
interface IVault {
    /**
     * @dev Emitted on ERC20 withdrawals
     */
    event WithdrewERC20(
        address indexed asset,
        uint256 amount,
        address indexed receiver
    );

    /**
     * @dev Emitted on ERC721 withdrawals
     */
    event WithdrewERC721(
        address indexed asset,
        uint256 tokenId,
        address receiver
    );

    /**
     * @dev Withdraws ERC20 of a given asset
     */
    function withdrawERC20(
        address asset,
        uint256 amount,
        address receiver
    ) external;

    /**
     * @dev Withdraws ERC721 with specified tokenId
     */
    function withdrawERC721(
        address asset,
        uint256 tokenId,
        address receiver
    ) external;
}
