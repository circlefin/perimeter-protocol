import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import {
  DEFAULT_POOL_SETTINGS,
  deployPoolControllerFactory,
  deployWithdrawControllerFactory
} from "../support/pool";
import { deployPermissionedServiceConfiguration } from "../support/serviceconfiguration";
import { deployToSAcceptanceRegistry } from "../support/tosacceptanceregistry";
import { getCommonSigners } from "../support/utils";
import { performVeriteVerification } from "../support/verite";

describe("PermissionedPoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const { operator, deployer, poolAdmin, otherAccount } =
      await getCommonSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

    // Deploy the Service Configuration contract
    const { serviceConfiguration: permissionedServiceConfiguration } =
      await deployPermissionedServiceConfiguration();

    // Deploy ToS Registry
    const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
      permissionedServiceConfiguration
    );

    // Configure ToS
    await permissionedServiceConfiguration
      .connect(operator)
      .setToSAcceptanceRegistry(tosAcceptanceRegistry.address);
    await tosAcceptanceRegistry
      .connect(operator)
      .updateTermsOfService("https://terms.example");

    // Add liquidity asset
    await permissionedServiceConfiguration
      .connect(operator)
      .setLiquidityAsset(liquidityAsset.address, true);

    // Deploy the PoolAdminAccessControl contract
    const PoolAdminAccessControl = await ethers.getContractFactory(
      "PoolAdminAccessControl"
    );
    const poolAdminAccessControl = await PoolAdminAccessControl.deploy(
      permissionedServiceConfiguration.address
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
      permissionedServiceConfiguration.address
    );

    const withdrawControllerFactory = await deployWithdrawControllerFactory(
      poolLib.address,
      permissionedServiceConfiguration.address
    );

    const poolControllerFactory = await deployPoolControllerFactory(
      poolLib.address,
      permissionedServiceConfiguration.address
    );

    // Deploy the PermissionedPoolFactory
    const PoolFactory = await ethers.getContractFactory(
      "PermissionedPoolFactory"
    );
    const poolFactory = await PoolFactory.deploy(
      permissionedServiceConfiguration.address,
      withdrawControllerFactory.address,
      poolControllerFactory.address,
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
    const tx = await permissionedServiceConfiguration
      .connect(operator)
      .setPoolAdminAccessControl(poolAdminAccessControl.address);
    await tx.wait();

    return {
      poolFactory,
      poolAdminAccessControl,
      operator,
      poolAdmin,
      otherAccount,
      liquidityAsset,
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

  it("access control reverts if PM hasn't accepted ToS", async () => {
    const { poolAdminAccessControl, operator, poolAdmin } = await loadFixture(
      deployFixture
    );

    await expect(
      performVeriteVerification(poolAdminAccessControl, operator, poolAdmin)
    ).to.be.revertedWith("MISSING_TOS_ACCEPTANCE");
  });
});
