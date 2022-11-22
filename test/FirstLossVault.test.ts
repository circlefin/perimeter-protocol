import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("FirstLossVault", () => {
  const VAULT_BALANCE = ethers.BigNumber.from(100);

  async function deployFixture() {
    const [liquidityProvider, poolController, otherAccount] =
      await ethers.getSigners();

    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC", 18);
    await liquidityAsset.deployed();

    const FirstLossVault = await ethers.getContractFactory("FirstLossVault");
    const firstLossVault = await FirstLossVault.deploy(
      poolController.address,
      liquidityAsset.address
    );
    await firstLossVault.deployed();

    await liquidityAsset.mint(firstLossVault.address, VAULT_BALANCE);

    return {
      firstLossVault,
      liquidityProvider,
      poolController,
      liquidityAsset,
      otherAccount
    };
  }

  describe("Deployment", async () => {
    it("sets the pool controller", async () => {
      const { firstLossVault, poolController } = await loadFixture(
        deployFixture
      );

      expect(await firstLossVault.poolController()).to.equal(
        poolController.address
      );
    });

    it("sets the liquidity asset", async () => {
      const { firstLossVault, liquidityAsset } = await loadFixture(
        deployFixture
      );

      expect(await firstLossVault.asset()).to.equal(liquidityAsset.address);
    });
  });

  describe("withdraw()", async () => {
    it("pool admin can withdrawn amounts", async () => {
      const { firstLossVault, liquidityAsset, poolController } =
        await loadFixture(deployFixture);

      const amountToWithdraw = ethers.BigNumber.from(50);

      // Pool balance prior
      const poolBalancePrior = await liquidityAsset.balanceOf(
        poolController.address
      );

      // Pull funds from locker
      await firstLossVault
        .connect(poolController)
        .withdraw(amountToWithdraw, poolController.address);

      expect(await liquidityAsset.balanceOf(poolController.address)).to.equal(
        poolBalancePrior.add(amountToWithdraw)
      );
    });
  });

  describe("Permissions", async () => {
    it("only pool admin can withdraw", async () => {
      const { firstLossVault, poolController, otherAccount } =
        await loadFixture(deployFixture);

      await expect(
        firstLossVault
          .connect(otherAccount)
          .withdraw(50, poolController.address)
      ).to.be.revertedWith("FirstLossVault: caller not pool controller");
    });
  });
});
