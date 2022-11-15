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
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    )
        Pool(
            liquidityAsset,
            poolAdmin,
            serviceConfiguration,
            withdrawController,
            poolSettings,
            tokenName,
            tokenSymbol
        )
    {
        poolAccessControl = new PoolAccessControl(
            address(this),
            IServiceConfiguration(serviceConfiguration).tosAcceptanceRegistry()
        );
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
