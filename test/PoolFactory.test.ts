import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolFactory", () => {
  const MOCK_LIQUIDITY_ADDRESS = "0x0000000000000000000000000000000000000001";

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

    const PoolLib = await ethers.getContractFactory("PoolLib");
    const poolLib = await PoolLib.deploy();

    const PoolFactory = await ethers.getContractFactory("PoolFactory", {
      libraries: {
        PoolLib: poolLib.address
      }
    });
    const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
    await poolFactory.deployed();

    return {
      poolFactory
    };
  }

  it("reverts if given a zero withdraw window", async () => {
    const { poolFactory } = await loadFixture(deployFixture);

    await expect(
      poolFactory.createPool(
        MOCK_LIQUIDITY_ADDRESS,
        0,
        0,
        0,
        0,
        /* window: */ 0
      )
    ).to.be.revertedWith("PoolFactory: Invalid duration");
  });

  it("emits PoolCreated", async () => {
    const { poolFactory } = await loadFixture(deployFixture);

    await expect(
      poolFactory.createPool(
        MOCK_LIQUIDITY_ADDRESS,
        0,
        0,
        0,
        0,
        /* window: */ 1
      )
    ).to.emit(poolFactory, "PoolCreated");
  });
});
