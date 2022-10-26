import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "./support/erc20";
import { DEFAULT_POOL_SETTINGS } from "./support/pool";

describe("PoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator] = await ethers.getSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

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
      poolFactory,
      liquidityAsset
    };
  }

  it("reverts if given a zero withdraw window", async () => {
    const { poolFactory, liquidityAsset } = await loadFixture(deployFixture);

    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawRequestPeriodDuration: 0
    });
    await expect(
      poolFactory.createPool(
        /* liquidityAsset */ liquidityAsset.address,
        poolSettings
      )
    ).to.be.revertedWith("PoolFactory: Invalid duration");
  });

  it("emits PoolCreated", async () => {
    const { poolFactory, liquidityAsset } = await loadFixture(deployFixture);

    await expect(
      poolFactory.createPool(
        /* liquidityAsset */ liquidityAsset.address,
        DEFAULT_POOL_SETTINGS
      )
    ).to.emit(poolFactory, "PoolCreated");
  });
});
