import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolFactory", () => {
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
    await expect(poolFactory.createPool()).to.emit(poolFactory, "PoolCreated");
  });
});
