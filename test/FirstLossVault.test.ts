import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("FirstLossVault", () => {
  const VAULT_BALANCE = ethers.BigNumber.from(100);

  async function deployFixture() {
    const [liquidityProvider, pool, otherAccount] = await ethers.getSigners();

    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC", 18);
    await liquidityAsset.deployed();

    const FirstLossVault = await ethers.getContractFactory("FirstLossVault");
    const firstLossVault = await FirstLossVault.deploy(
      pool.address,
      liquidityAsset.address
    );
    await firstLossVault.deployed();

    await liquidityAsset.mint(firstLossVault.address, VAULT_BALANCE);

    return {
      firstLossVault,
      liquidityProvider,
      pool,
      liquidityAsset,
      otherAccount
    };
  }

  describe("Deployment", async () => {
    it("sets the pool", async () => {
      const { firstLossVault, pool } = await loadFixture(deployFixture);

      expect(await firstLossVault.pool()).to.equal(pool.address);
    });

    it("sets the liquidity asset", async () => {
      const { firstLossVault, liquidityAsset } = await loadFixture(
        deployFixture
      );

      expect(await firstLossVault.asset()).to.equal(liquidityAsset.address);
    });
  });

  describe("withdraw()", async () => {
    it("pool manager can withdrawn amounts", async () => {
      const { firstLossVault, liquidityAsset, pool } = await loadFixture(
        deployFixture
      );

      const amountToWithdraw = ethers.BigNumber.from(50);

      // Pool balance prior
      const poolBalancePrior = await liquidityAsset.balanceOf(pool.address);

      // Pull funds from locker
      await firstLossVault
        .connect(pool)
        .withdraw(amountToWithdraw, pool.address);

      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(
        poolBalancePrior.add(amountToWithdraw)
      );
    });
  });

  describe("Permissions", async () => {
    it("only pool manager can withdraw", async () => {
      const { firstLossVault, pool, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(
        firstLossVault.connect(otherAccount).withdraw(50, pool.address)
      ).to.be.revertedWith("FirstLossVault: caller not pool");
    });
  });
});
