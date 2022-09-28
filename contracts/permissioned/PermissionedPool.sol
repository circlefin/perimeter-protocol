// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../Pool.sol";
import "./interfaces/IPoolAccessControl.sol";
import "./PoolAccessControl.sol";

/**
 * @title PermissionedPool
 */
contract PermissionedPool is Pool {
    /**
     * @dev The reference to the access control contract
     */
    IPoolAccessControl private _poolAccessControl;

    /**
     * @dev a modifier to only allow valid lenders to perform an action
     */
    modifier onlyValidLender() {
        require(
            _poolAccessControl.isValidLender(msg.sender),
            "caller is not a valid lender"
        );
        _;
    }

    /**
     * @dev The constructor for the PermissionedPool contract. It calls the
     * constructor of the Pool contract and then creates a new instance of the
     * PoolAccessControl contract.
     */
    constructor(
        address liquidityAsset,
        address poolManager,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) Pool(liquidityAsset, poolManager, poolSettings, tokenName, tokenSymbol) {
        _poolAccessControl = new PoolAccessControl(address(this));
    }

    /**
     * @inheritdoc Pool
     */
    function deposit(
        uint256, /* assets */
        address /* receiver */
    ) external override onlyValidLender returns (uint256 shares) {
        return 0;
    }

    /**
     * @inheritdoc Pool
     */
    function withdraw(
        uint256, /* assets */
        address, /* receiver */
        address /* owner */
    ) external override onlyValidLender returns (uint256 shares) {
        return 0;
    }

    /**
     * @inheritdoc Pool
     */
    function redeem(
        uint256, /* shares */
        address, /* receiver */
        address /* owner */
    ) external override onlyValidLender returns (uint256 assets) {
        return 0;
    }
}
