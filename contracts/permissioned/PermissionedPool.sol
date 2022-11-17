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
    modifier onlyPermittedLender() override {
        require(poolAccessControl.isAllowed(msg.sender), "LENDER_NOT_ALLOWED");
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
    function crank() public override {
        require(
            msg.sender == address(poolController) ||
                poolAccessControl.isAllowed(msg.sender),
            "Pool: not allowed"
        );
        super.crank();
    }

    /**
     * @inheritdoc Pool
     * @dev Since Pool does not enforce that msg.sender == receiver, we only
     * check the receiver here.
     */
    function maxDeposit(address receiver)
        public
        view
        override
        returns (uint256)
    {
        if (!poolAccessControl.isAllowed(receiver)) {
            return 0;
        }

        return super.maxDeposit(receiver);
    }

    /**
     * @inheritdoc Pool
<<<<<<< HEAD
     * @dev Since Pool does not enforce that msg.sender == receiver, we only
     * check the receiver here.
=======
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        returns (uint256 shares)
    {
        onlyValidLender();
        onlyValidReceiver(receiver);
        return super.deposit(assets, receiver);
    }

    /**
     * @inheritdoc Pool
>>>>>>> da6dc6c (Need confirmation on formula)
     */
    function maxMint(address receiver) public view override returns (uint256) {
        if (!poolAccessControl.isAllowed(receiver)) {
            return 0;
        }

        return super.maxMint(receiver);
    }
<<<<<<< HEAD
=======

    /**
     * @inheritdoc Pool
     */
    function mint(uint256 shares, address receiver)
        public
        override
        returns (uint256)
    {
        onlyValidLender();
        onlyValidReceiver(receiver);
        return super.mint(shares, receiver);
    }

    /**
     * @inheritdoc Pool
     */
    function withdraw(
        uint256, /* assets */
        address, /* receiver */
        address /* owner */
    ) external override returns (uint256 shares) {
        onlyValidLender();
        return 0;
    }

    /**
     * @inheritdoc Pool
     */
    function redeem(
        uint256, /* shares */
        address, /* receiver */
        address /* owner */
    ) external override returns (uint256 assets) {
        onlyValidLender();
        return 0;
    }
>>>>>>> da6dc6c (Need confirmation on formula)
}
