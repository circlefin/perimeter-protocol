import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PermissionedPoolFactory", () => {
  const MOCK_LIQUIDITY_ADDRESS = "0x0000000000000000000000000000000000000001";

  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, otherAccount] = await ethers.getSigners();

    // Deploy the Service Configuration contract
    const PermissionedServiceConfiguration = await ethers.getContractFactory(
      "PermissionedServiceConfiguration",
      operator
    );
    const permissionedServiceConfiguration =
      await PermissionedServiceConfiguration.deploy();
    await permissionedServiceConfiguration.deployed();

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
      otherAccount
    };
  }

  it("emits PoolCreated", async () => {
    const { poolFactory, poolManagerAccessControl, otherAccount } =
      await loadFixture(deployFixture);

    await poolManagerAccessControl.allow(otherAccount.getAddress());

    await expect(
      poolFactory
        .connect(otherAccount)
        .createPool(MOCK_LIQUIDITY_ADDRESS, 0, 0, 0)
    ).to.emit(poolFactory, "PoolCreated");
  });

  it("reverts if not called by a Pool Manager", async () => {
    const { poolFactory, poolManagerAccessControl, otherAccount } =
      await loadFixture(deployFixture);

    await poolManagerAccessControl.allow(otherAccount.getAddress());

    await expect(
      poolFactory.createPool(MOCK_LIQUIDITY_ADDRESS, 0, 0, 0)
    ).to.be.revertedWith("ServiceConfiguration: caller is not a pool manager");
  });
});
