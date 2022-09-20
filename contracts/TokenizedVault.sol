// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "./interfaces/IERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title AbstractTokenizedVault
 *
 * Basic partial implemention of ERC-4246, with hooks for concrete subclasses.
 */
abstract contract TokenizedVault is IERC4626, ERC20 {

    using SafeERC20 for IERC20;

    IERC20 public immutable underlyingAsset;
    
    constructor(
        address _asset, 
        string memory tokenName, 
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {
        underlyingAsset = IERC20(_asset);
    }

    /**
     * @dev Returns the address of the underlying ERC20 token "locked" by the vault.
     */
    function asset() external view returns (address) {
        return address(underlyingAsset);
    }

    /**
     * @dev Calculate the total amount of underlying assets held by the vault.
     */
    function totalAssets() external view returns (uint256) {
        return underlyingAsset.balanceOf(address(this));
    }

    /**
     * @dev Deposits assets of underlying tokens into the vault and grants ownership of shares to receiver.
     * Emits a {Deposit} event.
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require((shares = this.previewDeposit(assets)) > 0, "ATV: Nothing to deposit");

        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /**
     * @dev Mints exactly shares vault shares to receiver by depositing assets of underlying tokens.
     * Emits a {Deposit} event.
     */
    function mint(uint256 shares, address receiver) external returns (uint256 assets) {
        require((assets = this.previewMint(shares)) > 0, "ATV: Nothing to deposit");
        this.deposit(assets, receiver);
    }

    /**
     * @dev Burns shares from owner and send exactly assets token from the vault to receiver.
     * Emits a {Withdraw} event.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        require((shares = this.previewWithdraw(assets)) > 0, "ATV: Nothing to withdraw");

        if (owner != msg.sender) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        underlyingAsset.safeTransfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /**
     * @dev Redeems a specific number of shares from owner and send assets of underlying token from the vault to receiver.
     * Emits a {Withdraw} event.
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        require((assets = this.previewRedeem(shares)) > 0, "ATV: No Assets");
        this.withdraw(assets, receiver, owner);
    }
}