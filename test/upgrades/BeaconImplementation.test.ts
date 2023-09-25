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
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BeaconImplementation", () => {
  async function deployFixture() {
    const MockBeaconImplementation = await ethers.getContractFactory(
      "MockBeaconImplementation"
    );
    const mockBeaconImplementation = await MockBeaconImplementation.deploy();
    await mockBeaconImplementation.deployed();

    return {
      mockBeaconImplementation
    };
  }

  it("parents constructor is called", async () => {
    const { mockBeaconImplementation } = await loadFixture(deployFixture);

    // Since the parent calls _disableInitializers() in its constructor,
    // we expect any calls to initialize() to fail.
    await expect(mockBeaconImplementation.initialize()).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
  });
});
