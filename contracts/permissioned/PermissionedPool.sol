// SPDX-License-Identifier: MIT
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
     * @dev The initialize function for the PermissionedPool contract. It calls the
     * constructor of the Pool contract and then creates a new instance of the
     * PoolAccessControl contract.
     */
    function initialize(
        address liquidityAsset,
        address poolAdmin,
        address serviceConfiguration,
        address withdrawControllerFactory,
        address poolControllerFactory,
        address poolAccessControlFactory,
        IPoolConfigurableSettings memory poolSettings,
        string memory tokenName,
        string memory tokenSymbol
    ) public initializer {
        super.initialize(
            liquidityAsset,
            poolAdmin,
            serviceConfiguration,
            withdrawControllerFactory,
            poolControllerFactory,
            poolSettings,
            tokenName,
            tokenSymbol
        );
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
     * @dev Since Pool does not enforce that msg.sender == receiver, we only
     * check the receiver here.
     */
    function maxMint(address receiver) public view override returns (uint256) {
        if (!poolAccessControl.isAllowed(receiver)) {
            return 0;
        }

        return super.maxMint(receiver);
    }
}
