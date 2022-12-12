import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { activatePool, deployPool, depositToPool } from "../support/pool";
import { getCommonSigners } from "../support/utils";

describe("WithdrawController", () => {
  async function loadPoolFixture() {
    const {
      operator,
      deployer,
      poolAdmin,
      borrower,
      otherAccount,
      otherAccounts
    } = await getCommonSigners();

    const {
      pool,
      withdrawControllerFactory,
      poolLib,
      liquidityAsset,
      withdrawController
    } = await deployPool({
      poolAdmin: poolAdmin
    });

    return {
      operator,
      deployer,
      poolAdmin,
      borrower,
      otherAccount,
      otherAccounts,
      pool,
      liquidityAsset,
      withdrawController,
      withdrawControllerFactory,
      poolLib
    };
  }

  describe("withdrawPeriod()", () => {
    it("returns the first period when the pool is not yet initialized", async () => {
      const { withdrawController } = await loadFixture(loadPoolFixture);

      expect(await withdrawController.withdrawPeriod()).to.equal(0);
    });

    it("returns the first period when the pool is activated", async () => {
      const { pool, poolAdmin, liquidityAsset, withdrawController } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      expect(await withdrawController.withdrawPeriod()).to.equal(0);
    });

    it("returns the second period when the first period has ended", async () => {
      const { pool, poolAdmin, liquidityAsset, withdrawController } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      expect(await withdrawController.withdrawPeriod()).to.equal(1);
    });
  });

  describe("interestBearingBalanceOf()", () => {
    it("returns the number of shares minus the amount of redeemable shares", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        otherAccount,
        withdrawController
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      await depositToPool(pool, otherAccount, liquidityAsset, 100);

      expect(
        await withdrawController.interestBearingBalanceOf(otherAccount.address)
      ).to.equal(100);

      await pool.connect(otherAccount).requestRedeem(50);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      await pool.connect(poolAdmin).snapshot();

      const balance = await pool.balanceOf(otherAccount.address);
      const redeemable = await pool.maxRedeem(otherAccount.address);

      expect(
        await withdrawController.interestBearingBalanceOf(otherAccount.address)
      ).to.equal(48);
      expect(
        await withdrawController.interestBearingBalanceOf(otherAccount.address)
      ).to.equal(balance.sub(redeemable));
    });
  });

  describe("requestedBalanceOf()", () => {
    it("returns the requested, but not yet eligible number of shares for a given lender", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        otherAccount,
        withdrawController
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(50);

      expect(
        await withdrawController.requestedBalanceOf(otherAccount.address)
      ).to.equal(50);
    });
  });

  describe("totalRequestedBalance()", () => {
    it("returns the requested, but not yet eligible number of shares in this pool", async () => {
      const {
        pool,
        poolAdmin,
        otherAccounts,
        liquidityAsset,
        otherAccount,
        withdrawController
      } = await loadFixture(loadPoolFixture);

      const bob = otherAccounts[0];
      await activatePool(pool, poolAdmin, liquidityAsset);

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await depositToPool(pool, bob, liquidityAsset, 200);
      await pool.connect(otherAccount).requestRedeem(50);
      await pool.connect(bob).requestRedeem(120);

      expect(await withdrawController.totalRequestedBalance()).to.equal(170);
    });
  });

  describe("eligibleBalanceOf()", () => {
    it("returns the eligible number of shares for a given lender", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        otherAccount,
        withdrawController
      } = await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(50);

      expect(
        await withdrawController.eligibleBalanceOf(otherAccount.address)
      ).to.equal(0);

      await time.increase(withdrawRequestPeriodDuration);

      expect(
        await withdrawController.eligibleBalanceOf(otherAccount.address)
      ).to.equal(50);
    });
  });

  describe("totalEligibleBalance()", () => {
    it("returns the eligible number of shares in this pool", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        otherAccount,
        otherAccounts,
        withdrawController
      } = await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      const bob = otherAccounts[0];
      await activatePool(pool, poolAdmin, liquidityAsset);

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await depositToPool(pool, bob, liquidityAsset, 200);
      await pool.connect(otherAccount).requestRedeem(50);
      await pool.connect(bob).requestRedeem(120);

      expect(await withdrawController.totalEligibleBalance()).to.equal(0);

      await time.increase(withdrawRequestPeriodDuration);

      expect(await withdrawController.totalEligibleBalance()).to.equal(170);
    });
  });

  describe("totalWithdrawableAssets()", () => {
    it("returns the withdrawable number of shares in this pool", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        otherAccount,
        otherAccounts,
        withdrawController
      } = await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolAdmin).snapshot();

      expect(await withdrawController.totalWithdrawableAssets()).to.equal(39);

      // Redeem, expect it to decrement
      await pool
        .connect(otherAccount)
        .redeem(9, otherAccount.address, otherAccount.address);
      expect(await withdrawController.totalWithdrawableAssets()).to.equal(30);

      await pool.connect(bob).redeem(29, bob.address, bob.address);
      expect(await withdrawController.totalWithdrawableAssets()).to.equal(1); // snapshot dust
    });
  });

  describe("totalRedeemableShares()", () => {
    it("returns the redeemable number of shares in this pool", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        otherAccount,
        otherAccounts,
        withdrawController
      } = await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      // before the snapshot, check that redeemableShares is zero
      expect(await withdrawController.totalRedeemableShares()).to.equal(0);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolAdmin).snapshot();

      expect(await withdrawController.totalRedeemableShares()).to.equal(39); // 30 + 10 - snapshot dust

      // redeem, and see that it's decremented
      await pool.connect(bob).redeem(29, bob.address, bob.address);
      expect(await withdrawController.totalRedeemableShares()).to.equal(10); // other account needs to redeem

      await pool
        .connect(otherAccount)
        .redeem(9, otherAccount.address, otherAccount.address);
      expect(await withdrawController.totalRedeemableShares()).to.equal(1); // snapshot dust
    });
  });

  describe("Upgrades", () => {
    it("Can be upgraded", async () => {
      const {
        withdrawController,
        withdrawControllerFactory,
        poolLib,
        deployer
      } = await loadFixture(loadPoolFixture);

      // new implementation
      const V2Impl = await ethers.getContractFactory(
        "WithdrawControllerMockV2",
        {
          libraries: {
            PoolLib: poolLib.address
          }
        }
      );
      const v2Impl = await V2Impl.deploy();
      await expect(
        withdrawControllerFactory
          .connect(deployer)
          .setImplementation(v2Impl.address)
      ).to.emit(withdrawControllerFactory, "ImplementationSet");

      // Check that it upgraded
      const withdrawControllerV2 = V2Impl.attach(withdrawController.address);
      expect(await withdrawControllerV2.foo()).to.be.true;
    });
  });
});
