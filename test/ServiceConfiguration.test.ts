import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "./support/erc20";
import { deployServiceConfiguration } from "./support/serviceconfiguration";

describe("ServiceConfiguration", () => {
  async function deployFixture() {
    const [operator, otherAccount] = await ethers.getSigners();

    const { serviceConfiguration } = await deployServiceConfiguration();

    return {
      operator,
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
    it("can only be called by the operator", async () => {
      const { serviceConfiguration, operator, otherAccount } =
        await loadFixture(deployFixture);

      expect(await serviceConfiguration.paused()).to.equal(false);
      const tx = serviceConfiguration.connect(operator).setPaused(true);
      await expect(tx).not.to.be.reverted;
      expect(await serviceConfiguration.paused()).to.equal(true);

      const tx2 = serviceConfiguration.connect(otherAccount).setPaused(true);
      await expect(tx2).to.be.revertedWith(
        "ServiceConfiguration: caller is not an operator"
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
});