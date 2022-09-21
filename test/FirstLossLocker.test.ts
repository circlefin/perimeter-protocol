import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("FirstLossLocker", () => {
  const LOCKER_BALANCE = ethers.BigNumber.from(100);

  async function deployFixture() {
    const [liquidityProvider, pool, otherAccount] = await ethers.getSigners();

    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC");
    await liquidityAsset.deployed();

    const FirstLossLocker = await ethers.getContractFactory("FirstLossLocker");
    const firstLossLocker = await FirstLossLocker.deploy(
      pool.address,
      liquidityAsset.address
    );
    await firstLossLocker.deployed();

    await liquidityAsset.mint(firstLossLocker.address, LOCKER_BALANCE);

    return {
      firstLossLocker,
      liquidityProvider,
      pool,
      liquidityAsset,
      otherAccount
    };
  }

  describe("Deployment", async () => {
    it("sets the pool", async () => {
      const { firstLossLocker, pool } = await loadFixture(deployFixture);

      expect(await firstLossLocker.pool()).to.equal(pool.address);
    });

    it("sets the liquidity asset", async () => {
      const { firstLossLocker, liquidityAsset } = await loadFixture(
        deployFixture
      );

      expect(await firstLossLocker.asset()).to.equal(liquidityAsset.address);
    });
  });

  describe("withdraw()", async () => {
    it("pool manager can withdrawn amounts", async () => {
      const { firstLossLocker, liquidityAsset, pool } = await loadFixture(
        deployFixture
      );

      const amountToWithdraw = ethers.BigNumber.from(50);

      // Pool balance prior
      const poolBalancePrior = await liquidityAsset.balanceOf(pool.address);

      // Pull funds from locker
      await firstLossLocker
        .connect(pool)
        .withdraw(amountToWithdraw, pool.address);

      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(
        poolBalancePrior.add(amountToWithdraw)
      );
    });
  });

  describe("Permissions", async () => {
    it("only pool manager can withdraw", async () => {
      const { firstLossLocker, pool, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(
        firstLossLocker.connect(otherAccount).withdraw(50, pool.address)
      ).to.be.revertedWith("FirstLossLocker: caller not pool");
    });
  });
});
