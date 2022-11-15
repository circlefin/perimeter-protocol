import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "./support/erc20";
import {
  DEFAULT_POOL_SETTINGS,
  deployPoolControllerFactory,
  deployWithdrawControllerFactory
} from "./support/pool";

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

    const withdrawControllerFactory = await deployWithdrawControllerFactory(
      poolLib.address,
      serviceConfiguration.address
    );

    const poolControllerFactory = await deployPoolControllerFactory(
      poolLib.address,
      serviceConfiguration.address
    );

    return {
      poolFactory,
      liquidityAsset,
      withdrawControllerFactory,
      poolControllerFactory
    };
  }

  it("reverts if given a zero withdraw window", async () => {
    const {
      poolFactory,
      withdrawControllerFactory,
      poolControllerFactory,
      liquidityAsset
    } = await loadFixture(deployFixture);

    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawRequestPeriodDuration: 0
    });
    await expect(
      poolFactory.createPool(
        liquidityAsset.address,
        withdrawControllerFactory.address,
        poolControllerFactory.address,
        poolSettings
      )
    ).to.be.revertedWith("PoolFactory: Invalid duration");
  });

  it("reverts if given an invalid pool withdraw controller factory", async () => {
    const { poolFactory, poolControllerFactory, liquidityAsset } =
      await loadFixture(deployFixture);

    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawRequestPeriodDuration: 0
    });
    await expect(
      poolFactory.createPool(
        /* liquidityAsset */ liquidityAsset.address,
        "0x0000000000000000000000000000000000000000",
        poolControllerFactory.address,
        poolSettings
      )
    ).to.be.revertedWith("PoolFactory: Invalid duration");
  });

  it("reverts if given an invalid pool admin controller factory", async () => {
    const { poolFactory, withdrawControllerFactory, liquidityAsset } =
      await loadFixture(deployFixture);

    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawRequestPeriodDuration: 0
    });
    await expect(
      poolFactory.createPool(
        /* liquidityAsset */ liquidityAsset.address,
        withdrawControllerFactory.address,
        "0x0000000000000000000000000000000000000000",
        poolSettings
      )
    ).to.be.revertedWith("PoolFactory: Invalid duration");
  });

  it("emits PoolCreated", async () => {
    const {
      poolFactory,
      liquidityAsset,
      withdrawControllerFactory,
      poolControllerFactory
    } = await loadFixture(deployFixture);

    await expect(
      poolFactory.createPool(
        /* liquidityAsset */ liquidityAsset.address,
        withdrawControllerFactory.address,
        poolControllerFactory.address,
        DEFAULT_POOL_SETTINGS
      )
    ).to.emit(poolFactory, "PoolCreated");
  });
});
