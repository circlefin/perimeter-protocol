import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  activatePool,
  DEFAULT_POOL_SETTINGS,
  deployPermissionedPool,
  depositToPool,
  progressWithdrawWindow
} from "../support/pool";

describe("PermissionedPool", () => {
  async function loadPoolFixture() {
    const [
      operator,
      protocolAdmin,
      poolAdmin,
      otherAccount,
      thirdAccount,
      allowedLender
    ] = await ethers.getSigners();
    const {
      pool,
      liquidityAsset,
      poolAccessControl,
      tosAcceptanceRegistry,
      poolController
    } = await deployPermissionedPool({
      operator,
      poolAdmin: poolAdmin,
      protocolAdmin: protocolAdmin
    });

    // allow allowedLender
    await tosAcceptanceRegistry.connect(allowedLender).acceptTermsOfService();
    await poolAccessControl
      .connect(poolAdmin)
      .allowParticipant(allowedLender.address);

    return {
      pool,
      poolController,
      poolAccessControl,
      liquidityAsset,
      poolAdmin,
      otherAccount,
      thirdAccount,
      allowedLender
    };
  }

  describe("maxMint()", async () => {
    it("returns 0 if lender not in access control list", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      expect(
        await pool.connect(otherAccount).maxMint(otherAccount.address)
      ).to.equal(0);
    });

    it("returns a real value if lender is on access control list", async () => {
      const { pool, poolAdmin, allowedLender, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      expect(
        await pool.connect(allowedLender).maxMint(allowedLender.address)
      ).to.equal(DEFAULT_POOL_SETTINGS.maxCapacity);
    });
  });

  describe("maxDeposit()", async () => {
    it("returns 0 if lender or receiver not in access control list", async () => {
      const { pool, poolAdmin, otherAccount, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      expect(
        await pool.connect(otherAccount).maxMint(otherAccount.address)
      ).to.equal(0);
    });

    it("returns a real value if lender is on access control list", async () => {
      const { pool, poolAdmin, allowedLender, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      expect(
        await pool.connect(allowedLender).maxMint(allowedLender.address)
      ).to.equal(DEFAULT_POOL_SETTINGS.maxCapacity);
    });
  });

  describe("deposit()", () => {
    it("reverts if not allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        pool.connect(otherAccount).deposit(10, otherAccount.address)
      ).to.be.revertedWith("LENDER_NOT_ALLOWED");
    });

    it("allows deposits if allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, allowedLender } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await liquidityAsset.mint(allowedLender.address, 10);
      await liquidityAsset.connect(allowedLender).approve(pool.address, 10);

      await expect(
        pool.connect(allowedLender).deposit(10, allowedLender.address)
      ).to.emit(pool, "Deposit");
    });
  });

  describe("mint()", () => {
    it("reverts if not allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        pool.connect(otherAccount).mint(10, otherAccount.address)
      ).to.be.revertedWith("LENDER_NOT_ALLOWED");
    });

    it("allows minting if allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, allowedLender } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await liquidityAsset.mint(allowedLender.address, 10);
      await liquidityAsset.connect(allowedLender).approve(pool.address, 10);

      await expect(
        pool.connect(allowedLender).mint(10, allowedLender.address)
      ).to.emit(pool, "Deposit");
    });
  });

  describe("redeem()", () => {
    it("reverts if not allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        pool
          .connect(otherAccount)
          .redeem(10, otherAccount.address, otherAccount.address)
      ).to.be.revertedWith("LENDER_NOT_ALLOWED");
    });

    it("allows redeeming if allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, allowedLender } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, allowedLender, liquidityAsset, 10);

      await pool.connect(allowedLender).requestRedeem(5);
      await progressWithdrawWindow(pool);

      await expect(
        pool
          .connect(allowedLender)
          .redeem(1, allowedLender.address, allowedLender.address)
      ).to.emit(pool, "Withdraw");
    });
  });

  describe("withdraw()", () => {
    it("reverts if not allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        pool
          .connect(otherAccount)
          .withdraw(10, otherAccount.address, otherAccount.address)
      ).to.be.revertedWith("LENDER_NOT_ALLOWED");
    });

    it("allows withdrawing if allowed lender", async () => {
      const { pool, poolAdmin, liquidityAsset, allowedLender } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, allowedLender, liquidityAsset, 10);

      await pool.connect(allowedLender).requestRedeem(5);
      await progressWithdrawWindow(pool);

      await expect(
        pool
          .connect(allowedLender)
          .withdraw(1, allowedLender.address, allowedLender.address)
      ).to.emit(pool, "Withdraw");
    });
  });

  describe("crank()", () => {
    it("reverts if not allowed lender or admin", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      await expect(pool.connect(otherAccount).crank()).to.be.revertedWith(
        "Pool: not allowed"
      );
    });

    it("cranks the pool if allowed lender", async () => {
      const { pool, poolAdmin, allowedLender, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      await expect(pool.connect(allowedLender).crank()).to.emit(
        pool,
        "PoolCranked"
      );
    });

    it("cranks the pool if PA via poolController", async () => {
      const { pool, poolAdmin, poolController, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      await expect(poolController.connect(poolAdmin).crank()).to.emit(
        pool,
        "PoolCranked"
      );
    });
  });
});
