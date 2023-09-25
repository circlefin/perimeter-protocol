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
import { deployMockERC20 } from "../../support/erc20";
import {
  DEFAULT_POOL_SETTINGS,
  deployPoolControllerFactory,
  deployVaultFactory,
  deployWithdrawControllerFactory
} from "../../support/pool";
import { deployPermissionedServiceConfiguration } from "../../support/serviceconfiguration";
import { deployToSAcceptanceRegistry } from "../../support/tosacceptanceregistry";
import { getCommonSigners } from "../../support/utils";
import { performVeriteVerification } from "../../support/verite";

describe("PermissionedPoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const { operator, deployer, pauser, poolAdmin, otherAccount } =
      await getCommonSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

    // Deploy the Service Configuration contract
    const { serviceConfiguration } =
      await deployPermissionedServiceConfiguration();

    // Deploy ToS Registry
    const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
      serviceConfiguration
    );

    // Configure ToS
    await serviceConfiguration
      .connect(operator)
      .setToSAcceptanceRegistry(tosAcceptanceRegistry.address);
    await tosAcceptanceRegistry
      .connect(operator)
      .updateTermsOfService("https://terms.example");

    // Add liquidity asset
    await serviceConfiguration
      .connect(operator)
      .setLiquidityAsset(liquidityAsset.address, true);

    // Deploy the PoolAdminAccessControl contract
    const PoolAdminAccessControl = await ethers.getContractFactory(
      "PoolAdminAccessControl"
    );

    const poolAdminAccessControl = await upgrades.deployProxy(
      PoolAdminAccessControl,
      [serviceConfiguration.address],
      { kind: "uups" }
    );
    await poolAdminAccessControl.deployed();

    // Deploy library for linking
    const PoolLib = await ethers.getContractFactory("PoolLib");
    const poolLib = await PoolLib.deploy();

    // Deploy PoolAccessControlFactory as a dependency to the PoolFactory
    const PoolAccessControlFactory = await ethers.getContractFactory(
      "PoolAccessControlFactory"
    );
    const poolAccessControlFactory = await PoolAccessControlFactory.deploy(
      serviceConfiguration.address
    );

    // Deploy and attach implementation
    const PoolAccessControl = await ethers.getContractFactory(
      "PoolAccessControl"
    );
    const poolAccessControlImpl = await PoolAccessControl.deploy();
    await poolAccessControlFactory
      .connect(deployer)
      .setImplementation(poolAccessControlImpl.address);

    const withdrawControllerFactory = await deployWithdrawControllerFactory(
      poolLib.address,
      serviceConfiguration.address
    );

    const poolControllerFactory = await deployPoolControllerFactory(
      poolLib.address,
      serviceConfiguration.address
    );

    const vaultFactory = await deployVaultFactory(serviceConfiguration.address);

    // Deploy the PermissionedPoolFactory
    const PoolFactory = await ethers.getContractFactory(
      "PermissionedPoolFactory"
    );
    const poolFactory = await PoolFactory.deploy(
      serviceConfiguration.address,
      withdrawControllerFactory.address,
      poolControllerFactory.address,
      vaultFactory.address,
      poolAccessControlFactory.address
    );
    await poolFactory.deployed();

    // Deploy PermissionedPool implementation contract
    const PermissionedPoolImpl = await ethers.getContractFactory(
      "PermissionedPool",
      {
        libraries: {
          PoolLib: poolLib.address
        }
      }
    );
    const permissionedPoolImpl = await PermissionedPoolImpl.deploy();
    await permissionedPoolImpl.deployed();
    await poolFactory
      .connect(deployer)
      .setImplementation(permissionedPoolImpl.address);

    // Initialize ServiceConfiguration
    const tx = await serviceConfiguration
      .connect(operator)
      .setPoolAdminAccessControl(poolAdminAccessControl.address);
    await tx.wait();

    return {
      poolFactory,
      poolAdminAccessControl,
      operator,
      pauser,
      poolAdmin,
      otherAccount,
      liquidityAsset,
      serviceConfiguration,
      tosAcceptanceRegistry
    };
  }

  it("emits PoolCreated", async () => {
    const {
      operator,
      poolFactory,
      poolAdminAccessControl,
      poolAdmin,
      liquidityAsset,
      tosAcceptanceRegistry
    } = await loadFixture(deployFixture);

    await tosAcceptanceRegistry.connect(poolAdmin).acceptTermsOfService();
    await performVeriteVerification(
      poolAdminAccessControl,
      operator,
      poolAdmin
    );

    await expect(
      poolFactory
        .connect(poolAdmin)
        .createPool(liquidityAsset.address, DEFAULT_POOL_SETTINGS)
    ).to.emit(poolFactory, "PoolCreated");
  });

  it("reverts if not called by a verified Pool Admin", async () => {
    const {
      operator,
      poolFactory,
      poolAdminAccessControl,
      poolAdmin,
      otherAccount,
      liquidityAsset,
      tosAcceptanceRegistry
    } = await loadFixture(deployFixture);

    await tosAcceptanceRegistry.connect(poolAdmin).acceptTermsOfService();

    // Verify the pool Admin, not the otherAccount
    await performVeriteVerification(
      poolAdminAccessControl,
      operator,
      poolAdmin
    );

    await expect(
      poolFactory
        .connect(otherAccount)
        .createPool(liquidityAsset.address, DEFAULT_POOL_SETTINGS)
    ).to.be.revertedWith("CALLER_NOT_ADMIN");
  });

  it("reverts if the protocol is paused", async () => {
    const {
      operator,
      poolFactory,
      poolAdminAccessControl,
      poolAdmin,
      liquidityAsset,
      tosAcceptanceRegistry,
      serviceConfiguration,
      pauser
    } = await loadFixture(deployFixture);

    await tosAcceptanceRegistry.connect(poolAdmin).acceptTermsOfService();
    await performVeriteVerification(
      poolAdminAccessControl,
      operator,
      poolAdmin
    );

    // Pause the protocol
    await serviceConfiguration.connect(pauser).setPaused(true);

    const tx = poolFactory
      .connect(poolAdmin)
      .createPool(liquidityAsset.address, DEFAULT_POOL_SETTINGS);
    await expect(tx).to.be.revertedWith("PoolFactory: Protocol paused");
  });

  it("access control reverts if PM hasn't accepted ToS", async () => {
    const { poolAdminAccessControl, operator, poolAdmin } = await loadFixture(
      deployFixture
    );

    await expect(
      performVeriteVerification(poolAdminAccessControl, operator, poolAdmin)
    ).to.be.revertedWith("MISSING_TOS_ACCEPTANCE");
  });
});
