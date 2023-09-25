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

import "./interfaces/IVault.sol";
import "./interfaces/IServiceConfiguration.sol";
import "./upgrades/BeaconImplementation.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title Vault holds a balance, and allows withdrawals to the Vault's owner.
 * @dev Vaults are deployed as beacon proxy contracts.
 */
contract Vault is
    IVault,
    OwnableUpgradeable,
    BeaconImplementation,
    ERC721HolderUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev Reference to the global service configuration
     */
    IServiceConfiguration private _serviceConfiguration;

    /**
     * @dev Modifier to check that the protocol is not paused
     */
    modifier onlyNotPaused() {
        require(!_serviceConfiguration.paused(), "Vault: Protocol paused");
        _;
    }

    /**
     * @dev Initialize function as a Beacon proxy implementation.
     */
    function initialize(address owner, address serviceConfiguration)
        public
        initializer
    {
        __ERC721Holder_init();
        _transferOwnership(owner);
        _serviceConfiguration = IServiceConfiguration(serviceConfiguration);
    }

    /**
     * @inheritdoc IVault
     */
    function withdrawERC20(
        address asset,
        uint256 amount,
        address receiver
    ) external override onlyOwner onlyNotPaused {
        require(receiver != address(0), "Vault: 0 address");
        IERC20Upgradeable(asset).safeTransfer(receiver, amount);
        emit WithdrewERC20(asset, amount, receiver);
    }

    /**
     * @inheritdoc IVault
     */
    function withdrawERC721(
        address asset,
        uint256 tokenId,
        address receiver
    ) external override onlyOwner onlyNotPaused {
        require(receiver != address(0), "Vault: 0 address");
        IERC721Upgradeable(asset).safeTransferFrom(
            address(this),
            receiver,
            tokenId
        );
        emit WithdrewERC721(asset, tokenId, receiver);
    }
}
