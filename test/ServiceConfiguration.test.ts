import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deployMockERC20 } from "./support/erc20";
import { deployServiceConfiguration } from "./support/serviceconfiguration";
import { getCommonSigners } from "./support/utils";

describe("ServiceConfiguration", () => {
  async function deployFixture() {
    const { admin, operator, deployer, pauser, otherAccount } =
      await getCommonSigners();

    const { serviceConfiguration } = await deployServiceConfiguration();

    // Grant operator
    await serviceConfiguration
      .connect(admin)
      .grantRole(await serviceConfiguration.OPERATOR_ROLE(), operator.address);

    // Grant deployer
    await serviceConfiguration
      .connect(admin)
      .grantRole(await serviceConfiguration.DEPLOYER_ROLE(), deployer.address);

    return {
      admin,
      operator,
      pauser,
      deployer,
      otherAccount,
      serviceConfiguration
    };
  }

  describe("Deployment", async () => {
    it("has default values", async () => {
      const { serviceConfiguration } = await loadFixture(deployFixture);
      expect(await serviceConfiguration.paused()).to.equal(false);
      expect(await serviceConfiguration.firstLossFeeBps()).to.equal(500);
      expect(await serviceConfiguration.tosAcceptanceRegistry()).to.equal(
        "0x0000000000000000000000000000000000000000"
      );
    });
  });

  describe("setPaused", () => {
    it("can only be called by the pauser", async () => {
      const { serviceConfiguration, pauser, otherAccount } = await loadFixture(
        deployFixture
      );

      expect(await serviceConfiguration.paused()).to.equal(false);
      const tx = serviceConfiguration.connect(pauser).setPaused(true);
      await expect(tx).not.to.be.reverted;
      expect(await serviceConfiguration.paused()).to.equal(true);

      const tx2 = serviceConfiguration.connect(otherAccount).setPaused(true);
      await expect(tx2).to.be.revertedWith(
        "ServiceConfiguration: caller is not a pauser"
      );
    });
  });

  describe("setLiquidityAsset", () => {
    it("can only be called by the operator", async () => {
      const { serviceConfiguration, operator, otherAccount } =
        await loadFixture(deployFixture);

      const { mockERC20 } = await deployMockERC20();

      expect(
        await serviceConfiguration.isLiquidityAsset(mockERC20.address)
      ).to.equal(false);

      const tx = serviceConfiguration
        .connect(operator)
        .setLiquidityAsset(mockERC20.address, true);

      await expect(tx).not.to.be.reverted;
      expect(
        await serviceConfiguration.isLiquidityAsset(mockERC20.address)
      ).to.equal(true);

      const tx2 = serviceConfiguration
        .connect(otherAccount)
        .setLiquidityAsset(mockERC20.address, true);
      await expect(tx2).to.be.revertedWith(
        "ServiceConfiguration: caller is not an operator"
      );
    });
  });

  describe("setLoanFactory", () => {
    it("can only be called by the operator", async () => {
      const { serviceConfiguration, operator, otherAccount } =
        await loadFixture(deployFixture);

      const { mockERC20 } = await deployMockERC20();

      expect(
        await serviceConfiguration.isLoanFactory(mockERC20.address)
      ).to.equal(false);

      const tx = serviceConfiguration
        .connect(operator)
        .setLoanFactory(mockERC20.address, true);

      await expect(tx).not.to.be.reverted;
      expect(
        await serviceConfiguration.isLoanFactory(mockERC20.address)
      ).to.equal(true);

      const tx2 = serviceConfiguration
        .connect(otherAccount)
        .setLoanFactory(mockERC20.address, true);
      await expect(tx2).to.be.revertedWith(
        "ServiceConfiguration: caller is not an operator"
      );
    });
  });

  describe("setTosAcceptanceRegistry", () => {
    it("can only be called by the operator", async () => {
      const { serviceConfiguration, operator, otherAccount } =
        await loadFixture(deployFixture);

      expect(await serviceConfiguration.tosAcceptanceRegistry()).to.equal(
        "0x0000000000000000000000000000000000000000"
      );

      const tx = serviceConfiguration
        .connect(operator)
        .setToSAcceptanceRegistry("0x5FbDB2315678afecb367f032d93F642f64180aa3");

      await expect(tx).not.to.be.reverted;
      expect(await serviceConfiguration.tosAcceptanceRegistry()).to.equal(
        "0x5FbDB2315678afecb367f032d93F642f64180aa3"
      );

      const tx2 = serviceConfiguration
        .connect(otherAccount)
        .setToSAcceptanceRegistry("0x5FbDB2315678afecb367f032d93F642f64180aa3");
      await expect(tx2).to.be.revertedWith(
        "ServiceConfiguration: caller is not an operator"
      );
    });
  });

  describe("first loss minimums", () => {
    it("default to 0 for any given token", async () => {
      const { serviceConfiguration } = await loadFixture(deployFixture);

      const { mockERC20 } = await deployMockERC20();

      expect(
        await serviceConfiguration.firstLossMinimum(
          "0x0000000000000000000000000000000000000000"
        )
      ).to.equal(0);

      expect(
        await serviceConfiguration.firstLossMinimum(mockERC20.address)
      ).to.equal(0);
    });

    it("can be updated", async () => {
      const { serviceConfiguration, operator } = await loadFixture(
        deployFixture
      );

      const { mockERC20 } = await deployMockERC20();

      expect(
        await serviceConfiguration.firstLossMinimum(mockERC20.address)
      ).to.equal(0);

      await serviceConfiguration.connect(operator).setFirstLossMinimum(
        mockERC20.address,
        10_000_000000 // $10,000
      );

      expect(
        await serviceConfiguration.firstLossMinimum(mockERC20.address)
      ).to.equal(10_000_000000);
    });
  });

  describe("setFirstLossFeeBps", () => {
    it("can only be called by the operator", async () => {
      const { serviceConfiguration, operator, otherAccount } =
        await loadFixture(deployFixture);

      expect(await serviceConfiguration.firstLossFeeBps()).to.equal(500);

      const tx = serviceConfiguration
        .connect(operator)
        .setFirstLossFeeBps(10_00);

      await expect(tx).not.to.be.reverted;
      expect(await serviceConfiguration.firstLossFeeBps()).to.equal(10_00);

      const tx2 = serviceConfiguration
        .connect(otherAccount)
        .setFirstLossFeeBps(10_00);
      await expect(tx2).to.be.revertedWith(
        "ServiceConfiguration: caller is not an operator"
      );
    });
  });

  describe("Upgrades", () => {
    it("deployer can upgrade", async () => {
      const { serviceConfiguration, deployer } = await loadFixture(
        deployFixture
      );

      const ServiceConfiguration = await ethers.getContractFactory(
        "ServiceConfigurationMockV2",
        deployer
      );
      const upgradedServiceConfig = await upgrades.upgradeProxy(
        serviceConfiguration.address,
        ServiceConfiguration
      );
      expect(await upgradedServiceConfig.foo()).to.be.true;
    });

    it("others can't upgrade", async () => {
      const { serviceConfiguration, admin } = await loadFixture(deployFixture);

      const ServiceConfiguration = await ethers.getContractFactory(
        "ServiceConfigurationMockV2",
        admin
      );
      await expect(
        upgrades.upgradeProxy(
          serviceConfiguration.address,
          ServiceConfiguration
        )
      ).to.be.revertedWith("Upgrade: unauthorized");
    });
  });
});
