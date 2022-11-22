// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../Pool.sol";
import "./interfaces/IPoolAccessControl.sol";
import "./interfaces/IPoolAccessControlFactory.sol";
import "./PoolAccessControl.sol";

/**
 * @title PermissionedPool
 */
contract PermissionedPool is Pool {
    /**
     * @dev The reference to the access control contract
     */
    IPoolAccessControl public poolAccessControl;

    /**
     * @dev a modifier to only allow valid lenders to perform an action
     */
    modifier onlyValidLender() {
        require(
            poolAccessControl.isValidParticipant(msg.sender),
            "caller is not a valid lender"
        );
        _;
    }

    /**
     * @dev a modifier to only allow valid lenders to perform an action
     */
    modifier onlyValidReceiver(address receiver) {
        require(
            poolAccessControl.isValidParticipant(receiver),
            "receiver is not a valid lender"
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
        address poolAdmin,
        address serviceConfiguration,
        address withdrawController,
        address poolController,
        address poolAccessControlFactory,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    )
        Pool(
            liquidityAsset,
            poolAdmin,
            serviceConfiguration,
            withdrawController,
            poolController,
            poolSettings,
            tokenName,
            tokenSymbol
        )
    {
        poolAccessControl = IPoolAccessControl(
            IPoolAccessControlFactory(poolAccessControlFactory).create(
                address(this)
            )
        );
    }

    /**
     * @inheritdoc Pool
     */
    function crank()
        public
        override
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        require(
            msg.sender == address(poolController) ||
                poolAccessControl.isValidParticipant(msg.sender),
            "Pool: not allowed"
        );
        return super.crank();
    }

    /**
     * @inheritdoc Pool
     */
    function maxDeposit(address receiver)
        public
        view
        override
        returns (uint256)
    {
        if (
            !poolAccessControl.isValidParticipant(msg.sender) ||
            !poolAccessControl.isValidParticipant(receiver)
        ) {
            return 0;
        }

        return super.maxDeposit(receiver);
    }

    /**
     * @inheritdoc Pool
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        onlyValidLender
        onlyValidReceiver(receiver)
        returns (uint256 shares)
    {
        return super.deposit(assets, receiver);
    }

    /**
     * @inheritdoc Pool
     */
    function maxMint(address receiver) public view override returns (uint256) {
        if (
            !poolAccessControl.isValidParticipant(msg.sender) ||
            !poolAccessControl.isValidParticipant(receiver)
        ) {
            return 0;
        }

        return super.maxMint(receiver);
    }

    /**
     * @inheritdoc Pool
     */
    function mint(uint256 shares, address receiver)
        public
        override
        onlyValidLender
        onlyValidReceiver(receiver)
        returns (uint256)
    {
        return super.mint(shares, receiver);
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
