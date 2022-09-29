// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract CollateralVault is ERC721Holder {
    using SafeERC20 for IERC20;

    address private immutable _loan;

    modifier onlyLoan() {
        require(msg.sender == _loan, "CollateralVault: caller not loan");
        _;
    }

    constructor(address loan) {
        _loan = loan;
    }

    /**
     * @dev Allows withdrawal of funds held by vault.
     */
    function withdraw(
        address asset,
        uint256 amount,
        address receiver
    ) external onlyLoan {
        require(receiver != address(0), "CollateralVault: 0 address");
        IERC20(asset).safeTransfer(receiver, amount);
    }

    function withdrawERC721(
        address asset,
        uint256 tokenId,
        address receiver
    ) external onlyLoan {
        require(receiver != address(0), "CollateralVault: 0 address");
        IERC721(asset).safeTransferFrom(address(this), receiver, tokenId);
    }
}
