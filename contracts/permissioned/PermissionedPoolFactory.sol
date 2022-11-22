// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

// import "./interfaces/IPoolAdminAccessControl.sol";
import "./interfaces/IPermissionedServiceConfiguration.sol";
import "../interfaces/IPoolFactory.sol";
import "./PermissionedPool.sol";

/**
 * @title PermissionedPoolFactory
 */
contract PermissionedPoolFactory is IPoolFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    address private _serviceConfiguration;

    /**
     * @dev Reference to a PoolAccessControlFactory
     */
    address private _poolAccessControlFactory;

    constructor(address serviceConfiguration, address poolAccessControlFactory)
    {
        _serviceConfiguration = serviceConfiguration;
        _poolAccessControlFactory = poolAccessControlFactory;
    }

    /**
     * @dev Check that `msg.sender` is a PoolAdmin.
     */
    modifier onlyVerifiedPoolAdmin() {
        require(
            IPermissionedServiceConfiguration(_serviceConfiguration)
                .poolAdminAccessControl()
                .isAllowed(msg.sender),
            "caller is not allowed pool admin"
        );
        _;
    }

    /**
     * @inheritdoc IPoolFactory
     */
    function createPool(
        address liquidityAsset,
        address withdrawControllerFactory,
        address poolControllerFactory,
        IPoolConfigurableSettings calldata settings
    ) public override onlyVerifiedPoolAdmin returns (address poolAddress) {
        require(
            settings.withdrawRequestPeriodDuration > 0,
            "PoolFactory: Invalid duration"
        );

        PermissionedPool pool = new PermissionedPool(
            liquidityAsset,
            msg.sender,
            address(_serviceConfiguration),
            withdrawControllerFactory,
            poolControllerFactory,
            _poolAccessControlFactory,
            settings,
            "PerimeterPoolToken",
            "PPT"
        );
        address addr = address(pool);

        emit PoolCreated(addr);
        return addr;
    }
}
