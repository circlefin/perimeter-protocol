// SPDX-License-Identifier: MIT
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
 * @title Vault
 */
contract Vault is
    IVault,
    OwnableUpgradeable,
    BeaconImplementation,
    ERC721HolderUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

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
        require(receiver != address(0), "CollateralVault: 0 address");
        IERC721Upgradeable(asset).safeTransferFrom(
            address(this),
            receiver,
            tokenId
        );
        emit WithdrewERC721(asset, tokenId, receiver);
    }
}
