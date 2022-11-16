// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "../controllers/PoolController.sol";
import "../interfaces/IServiceConfiguration.sol";
import "./interfaces/IPoolControllerFactory.sol";

/**
 * @title PoolAdmin controller Factory
 */
contract PoolControllerFactory is IPoolControllerFactory {
    /**
     * @dev Reference to the ServiceConfiguration contract
     */
    address private _serviceConfiguration;

    constructor(address serviceConfiguration) {
        _serviceConfiguration = serviceConfiguration;
    }

    /**
     * @inheritdoc IPoolControllerFactory
     */
    function createController(
        address pool,
        address admin,
        IPoolConfigurableSettings memory poolSettings
    ) public virtual returns (address addr) {
        require(
            IServiceConfiguration(_serviceConfiguration).paused() == false,
            "PoolControllerFactory: Protocol paused"
        );

        PoolController controller = new PoolController(
            pool,
            admin,
            poolSettings
        );
        addr = address(controller);
        emit PoolControllerCreated(addr, admin);
    }
}
