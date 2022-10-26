import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import { DEFAULT_POOL_SETTINGS } from "../support/pool";
import { deployToSConsentRegistry } from "../support/tosconsentregistry";

describe("PermissionedPoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, otherAccount] = await ethers.getSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

    // Deploy the Service Configuration contract
    const PermissionedServiceConfiguration = await ethers.getContractFactory(
      "PermissionedServiceConfiguration",
      operator
    );
    const permissionedServiceConfiguration =
      await PermissionedServiceConfiguration.deploy();
    await permissionedServiceConfiguration.deployed();

    // Deploy ToS Registry
    const { termsOfServiceConsentRegistry } = await deployToSConsentRegistry(
      permissionedServiceConfiguration
    );

    // Configure ToS
    await permissionedServiceConfiguration
      .connect(operator)
      .setTermsOfServiceConsentRegistry(termsOfServiceConsentRegistry.address);
    await termsOfServiceConsentRegistry
      .connect(operator)
      .updateTermsOfService("https://terms.example");

    // Deploy the PoolManagerAccessControl contract
    const PoolManagerAccessControl = await ethers.getContractFactory(
      "PoolManagerAccessControl"
    );
    const poolManagerAccessControl = await PoolManagerAccessControl.deploy(
      permissionedServiceConfiguration.address
    );
    await poolManagerAccessControl.deployed();

    // Deploy library for linking
    const PoolLib = await ethers.getContractFactory("PoolLib");
    const poolLib = await PoolLib.deploy();

    // Deploy the PermissionedPoolFactory
    const PoolFactory = await ethers.getContractFactory(
      "PermissionedPoolFactory",
      {
        libraries: {
          PoolLib: poolLib.address
        }
      }
    );
    const poolFactory = await PoolFactory.deploy(
      permissionedServiceConfiguration.address
    );
    await poolFactory.deployed();

    // Initialize ServiceConfiguration
    const tx =
      await permissionedServiceConfiguration.setPoolManagerAccessControl(
        poolManagerAccessControl.address
      );
    await tx.wait();

    return {
      poolFactory,
      poolManagerAccessControl,
      operator,
      otherAccount,
      liquidityAsset,
      termsOfServiceConsentRegistry
    };
  }

  it("emits PoolCreated", async () => {
    const {
      poolFactory,
      poolManagerAccessControl,
      otherAccount,
      liquidityAsset,
      termsOfServiceConsentRegistry
    } = await loadFixture(deployFixture);

    await termsOfServiceConsentRegistry.connect(otherAccount).recordConsent();
    await poolManagerAccessControl.allow(otherAccount.getAddress());
    await termsOfServiceConsentRegistry.connect(otherAccount).recordConsent();

    await expect(
      poolFactory
        .connect(otherAccount)
        .createPool(
          /* liquidityAsset */ liquidityAsset.address,
          DEFAULT_POOL_SETTINGS
        )
    ).to.emit(poolFactory, "PoolCreated");
  });

  it("reverts if not called by a Pool Manager", async () => {
    const {
      poolFactory,
      poolManagerAccessControl,
      otherAccount,
      liquidityAsset,
      termsOfServiceConsentRegistry
    } = await loadFixture(deployFixture);

    await termsOfServiceConsentRegistry.connect(otherAccount).recordConsent();
    await poolManagerAccessControl.allow(otherAccount.getAddress());

    await expect(
      poolFactory.createPool(
        /* liquidityAsset */ liquidityAsset.address,
        DEFAULT_POOL_SETTINGS
      )
    ).to.be.revertedWith("caller is not allowed pool manager");
  });

  it("access control reverts if PM hasn't accepted ToS", async () => {
    const {
      poolFactory,
      poolManagerAccessControl,
      otherAccount,
      liquidityAsset
    } = await loadFixture(deployFixture);

    await expect(
      poolManagerAccessControl.allow(otherAccount.getAddress())
    ).to.be.revertedWith("Pool: no ToS consent recorded");
  });
});
