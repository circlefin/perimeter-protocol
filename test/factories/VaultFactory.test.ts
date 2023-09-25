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
import { getCommonSigners } from "../support/utils";
import { deployServiceConfiguration } from "../support/serviceconfiguration";

describe("VaultFactory", () => {
  async function deployVaultFactoryFixture() {
    const { deployer, other } = await getCommonSigners();
    const { serviceConfiguration } = await deployServiceConfiguration();

    const Factory = await ethers.getContractFactory("VaultFactory");
    const factory = await Factory.deploy(serviceConfiguration.address);

    // Create Vault implementation
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    return {
      vault,
      factory,
      deployer,
      other
    };
  }

  describe("createVault()", () => {
    it("reverts if no implementation is set", async () => {
      const { factory, other } = await loadFixture(deployVaultFactoryFixture);

      await expect(factory.createVault(other.address)).to.be.revertedWith(
        "VaultFactory: no implementation set"
      );
    });
  });
});
