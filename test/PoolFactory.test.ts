import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolFactory", () => {

  const MOCK_LIQUIDITY_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  async function deployFixture() {
    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    const poolFactory = await PoolFactory.deploy();
    await poolFactory.deployed();

    return {
      poolFactory
    };
  }

  it("emits PoolCreated", async () => {
    const { poolFactory } = await loadFixture(deployFixture);

    await expect(poolFactory.createPool(
      MOCK_LIQUIDITY_ADDRESS,
      1_000_000,
      (await time.latest()) + (60 * 60),
      0
    ))
      .to.emit(poolFactory, "PoolCreated");
  });

});
