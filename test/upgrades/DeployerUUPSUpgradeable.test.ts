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
import { ethers, upgrades } from "hardhat";
import { deployServiceConfiguration } from "../support/serviceconfiguration";
import { getCommonSigners } from "../support/utils";

describe("DeployerUUPSUpgradeable", () => {
  async function deployFixture() {
    const { deployer, other } = await getCommonSigners();

    const { serviceConfiguration } = await deployServiceConfiguration();

    const DeployerUUPSUpgradeableMock = await ethers.getContractFactory(
      "DeployerUUPSUpgradeableMock",
      deployer
    );
    const deployerUUPSUpgradeableMock = await upgrades.deployProxy(
      DeployerUUPSUpgradeableMock,
      [serviceConfiguration.address],
      { kind: "uups" }
    );
    await deployerUUPSUpgradeableMock.deployed();

    return {
      deployerUUPSUpgradeableMock,
      deployer,
      other
    };
  }

  describe("Upgrades", () => {
    it("can be upgraded", async () => {
      const { deployerUUPSUpgradeableMock, deployer } = await loadFixture(
        deployFixture
      );

      const V2 = await ethers.getContractFactory(
        "DeployerUUPSUpgradeableMockV2",
        deployer
      );
      await upgrades.upgradeProxy(deployerUUPSUpgradeableMock.address, V2);

      const v2 = await ethers.getContractAt(
        "DeployerUUPSUpgradeableMockV2",
        deployerUUPSUpgradeableMock.address
      );
      expect(await v2.foo()).to.equal("baz");
    });
  });

  describe("Permissions", () => {
    it("only deployer can upgrade", async () => {
      const { deployerUUPSUpgradeableMock, other } = await loadFixture(
        deployFixture
      );

      const V2 = await ethers.getContractFactory(
        "DeployerUUPSUpgradeableMockV2",
        other
      );
      await expect(
        upgrades.upgradeProxy(deployerUUPSUpgradeableMock.address, V2)
      ).to.be.revertedWith("Upgrade: unauthorized");
    });
  });
});
