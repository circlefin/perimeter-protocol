/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity ^0.8.16;

import "../../interfaces/IPool.sol";

/**
 * @title Interface for the PoolController factory.
 */
interface IPoolControllerFactory {
    /**
     * @dev Emitted when a pool is created.
     */
    event PoolControllerCreated(address indexed pool, address indexed addr);

    /**
     * @dev Creates a pool's PoolAdmin controller
     * @dev Emits `PoolControllerCreated` event.
     */
    function createController(
        address pool,
        address serviceConfiguration,
        address admin,
        address liquidityAsset,
        address vaultFactory,
        IPoolConfigurableSettings memory poolSettings
    ) external returns (address);
}
