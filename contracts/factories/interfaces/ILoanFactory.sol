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

import "../../interfaces/ILoan.sol";

/**
 * @title Interface for the LoanFactory.
 */
interface ILoanFactory {
    /**
     * @dev Emitted when a loan is created.
     */
    event LoanCreated(address indexed addr);

    /**
     * @dev Creates a loan
     * @dev Emits `LoanCreated` event.
     */
    function createLoan(
        address borrower,
        address pool,
        address liquidityAsset,
        ILoanSettings memory settings
    ) external returns (address);

    /**
     * @dev Checks whether a Loan address was created by the factory.
     */
    function isLoan(address loan) external view returns (bool);
}
