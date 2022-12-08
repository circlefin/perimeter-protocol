// SPDX-License-Identifier: MIT UNLICENSED
pragma solidity ^0.8.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPool} from "./interfaces/IPool.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FeeVault {
    using SafeERC20 for IERC20;

    address public immutable pool;

    modifier onlyPoolAdmin() {
        require(
            msg.sender == IPool(pool).admin(),
            "FeeVault: caller not pool admin"
        );
        _;
    }

    constructor(address pool_) {
        pool = pool_;
    }

    /**
     * @dev Allows withdrawal of fees held by vault.
     */
    function withdraw(address asset, uint256 amount) external onlyPoolAdmin {
        require(
            IPool(pool).serviceConfiguration().paused() == false,
            "FeeVault: Protocol paused"
        );
        IERC20(asset).safeTransfer(msg.sender, amount);
    }
}
