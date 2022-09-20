import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PermissionedPoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, otherAccount] = await ethers.getSigners();

    // Deploy the Service Configuration contract
    const ServiceConfiguration = await ethers.getContractFactory(
      "ServiceConfiguration",
      operator
    );
    const serviceConfiguration = await ServiceConfiguration.deploy();
    await serviceConfiguration.deployed();

    // Deploy the PoolManagerPermission contract
    const PoolManagerPermission = await ethers.getContractFactory(
      "PoolManagerPermission"
    );
    const poolManagerPermission = await PoolManagerPermission.deploy(
      serviceConfiguration.address
    );
    await poolManagerPermission.deployed();

    // Deploy the MockVeriteVerificationRegistry contract
    const MockVeriteVerificationRegistry = await ethers.getContractFactory(
      "MockVeriteVerificationRegistry"
    );
    const mockVeriteVerificationRegistry =
      await MockVeriteVerificationRegistry.deploy();
    await mockVeriteVerificationRegistry.deployed();

    // Deploy the PermissionedPoolFactory
    const PoolFactory = await ethers.getContractFactory(
      "PermissionedPoolFactory"
    );
    const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
    await poolFactory.deployed();

    // Initialize ServiceConfiguration
    const tx = await serviceConfiguration.setPoolManagerPermission(
      poolManagerPermission.address
    );
    await tx.wait();

    return {
      poolFactory,
      poolManagerPermission,
      mockVeriteVerificationRegistry,
      operator,
      otherAccount
    };
  }

  it("emits PoolCreated", async () => {
    const { poolFactory, poolManagerPermission, otherAccount } =
      await loadFixture(deployFixture);

    await poolManagerPermission.allow(otherAccount.getAddress());

    await expect(poolFactory.connect(otherAccount).createPool()).to.emit(
      poolFactory,
      "PoolCreated"
    );
  });

  it("reverts if not called by a Pool Manager", async () => {
    const { poolFactory, poolManagerPermission, otherAccount } =
      await loadFixture(deployFixture);

    await poolManagerPermission.allow(otherAccount.getAddress());

    await expect(poolFactory.createPool()).to.be.revertedWith(
      "PoolFactory: Not PM"
    );
  });
});
