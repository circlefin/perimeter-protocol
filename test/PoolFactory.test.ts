import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "./support/erc20";
import {
  DEFAULT_POOL_SETTINGS,
  deployPoolControllerFactory,
  deployWithdrawControllerFactory
} from "./support/pool";
import { deployServiceConfiguration } from "./support/serviceconfiguration";
import { getCommonSigners } from "./support/utils";

describe("PoolFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const { operator, deployer } = await getCommonSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

    // Deploy the Service Configuration contract
    const { serviceConfiguration } = await deployServiceConfiguration();

    // Add ERC20 as support currency
    await serviceConfiguration
      .connect(operator)
      .setLiquidityAsset(liquidityAsset.address, true);

    const PoolLib = await ethers.getContractFactory("PoolLib");
    const poolLib = await PoolLib.deploy();

    const withdrawControllerFactory = await deployWithdrawControllerFactory(
      poolLib.address,
      serviceConfiguration.address
    );

    const poolControllerFactory = await deployPoolControllerFactory(
      poolLib.address,
      serviceConfiguration.address
    );

    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    const poolFactory = await PoolFactory.deploy(
      serviceConfiguration.address,
      withdrawControllerFactory.address,
      poolControllerFactory.address
    );

    await poolFactory.deployed();

    // Set Pool implementation on Factory
    const PoolImpl = await ethers.getContractFactory("Pool", {
      libraries: {
        PoolLib: poolLib.address
      }
    });
    const poolImpl = await PoolImpl.deploy();
    await poolFactory.connect(deployer).setImplementation(poolImpl.address);

    return {
      operator,
      deployer,
      poolFactory,
      liquidityAsset,
      serviceConfiguration
    };
  }

  it("reverts if there's no implementation set", async () => {
    const { poolFactory, liquidityAsset, deployer } = await loadFixture(
      deployFixture
    );

    // set implementation to 0
    await poolFactory
      .connect(deployer)
      .setImplementation(ethers.constants.AddressZero);

    // ensure it reverts
    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawRequestPeriodDuration: 0
    });
    await expect(
      poolFactory.createPool(liquidityAsset.address, poolSettings)
    ).to.be.revertedWith("PoolFactory: no implementation set");
  });

  it("reverts if given a zero withdraw window", async () => {
    const { poolFactory, liquidityAsset } = await loadFixture(deployFixture);

    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawRequestPeriodDuration: 0
    });
    await expect(
      poolFactory.createPool(liquidityAsset.address, poolSettings)
    ).to.be.revertedWith("PoolFactory: Invalid duration");
  });

  it("reverts if the first loss minimum is not sufficient", async () => {
    const { serviceConfiguration, poolFactory, liquidityAsset, operator } =
      await loadFixture(deployFixture);

    // Set a first loss minimum
    await serviceConfiguration
      .connect(operator)
      .setFirstLossMinimum(liquidityAsset.address, 1);

    // Attempt to create a pool with 0 first loss minimum
    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      firstLossInitialMinimum: 0 // $0
    });
    await expect(
      poolFactory.createPool(liquidityAsset.address, poolSettings)
    ).to.be.revertedWith("PoolFactory: Invalid first loss minimum");
  });

  it("reverts if withdraw gate is too large", async () => {
    const { operator, serviceConfiguration, poolFactory, liquidityAsset } =
      await loadFixture(deployFixture);

    // Set a first loss minimum
    await serviceConfiguration
      .connect(operator)
      .setFirstLossMinimum(liquidityAsset.address, 1);

    // Attempt to create a pool with > 100% withdraw gate
    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      withdrawGateBps: 10_001
    });
    await expect(
      poolFactory.createPool(liquidityAsset.address, poolSettings)
    ).to.be.revertedWith("PoolFactory: Invalid withdraw gate");
  });

  it("reverts if withdrawal request fee is too large", async () => {
    const { operator, serviceConfiguration, poolFactory, liquidityAsset } =
      await loadFixture(deployFixture);

    // Set a first loss minimum
    await serviceConfiguration
      .connect(operator)
      .setFirstLossMinimum(liquidityAsset.address, 1);

    // Attempt to create a pool with > 100% withdraw gate
    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      requestFeeBps: 10_001
    });
    await expect(
      poolFactory.createPool(liquidityAsset.address, poolSettings)
    ).to.be.revertedWith("PoolFactory: Invalid request fee");
  });

  it("reverts if withdrawal request cancellation fee is too large", async () => {
    const { operator, serviceConfiguration, poolFactory, liquidityAsset } =
      await loadFixture(deployFixture);

    // Set a first loss minimum
    await serviceConfiguration
      .connect(operator)
      .setFirstLossMinimum(liquidityAsset.address, 1);

    // Attempt to create a pool with > 100% withdraw gate
    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      requestCancellationFeeBps: 10_001
    });
    await expect(
      poolFactory.createPool(liquidityAsset.address, poolSettings)
    ).to.be.revertedWith("PoolFactory: Invalid request cancellation fee");
  });

  it("reverts if liquidity asset is not supported", async () => {
    const { poolFactory } = await loadFixture(deployFixture);

    const { mockERC20: otherAsset } = await deployMockERC20();

    await expect(
      poolFactory.createPool(otherAsset.address, DEFAULT_POOL_SETTINGS)
    ).to.be.revertedWith("PoolFactory: invalid asset");
  });

  it("emits PoolCreated", async () => {
    const { poolFactory, liquidityAsset } = await loadFixture(deployFixture);

    await expect(
      poolFactory.createPool(liquidityAsset.address, DEFAULT_POOL_SETTINGS)
    ).to.emit(poolFactory, "PoolCreated");
  });

  it.only("deployer can set new implementations", async () => {
    const {
      poolFactory,
      liquidityAsset: mockNewImplementation,
      deployer
    } = await loadFixture(deployFixture);

    // set implementation to a mock new value
    await expect(
      poolFactory
        .connect(deployer)
        .setImplementation(mockNewImplementation.address)
    ).to.emit(poolFactory, "ImplementationSet");
  });
});
