import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator] = await ethers.getSigners();

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

    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
    await poolFactory.deployed();

    return {
      poolFactory
    };
  }

  it("emits PoolCreated", async () => {
    const { poolFactory } = await loadFixture(deployFixture);
    await expect(poolFactory.createPool()).to.emit(poolFactory, "PoolCreated");
  });
});
