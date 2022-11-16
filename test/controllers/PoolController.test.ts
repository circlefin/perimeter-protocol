import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { collateralizeLoan, deployLoan, fundLoan } from "../support/loan";
import { activatePool, deployPool, depositToPool } from "../support/pool";

describe("PoolController", () => {
  async function loadPoolFixture() {
    const [operator, poolAdmin, borrower, otherAccount, ...otherAccounts] =
      await ethers.getSigners();

    const { pool, liquidityAsset, poolController, serviceConfiguration } =
      await deployPool({
        operator,
        poolAdmin: poolAdmin
      });

    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return {
      operator,
      poolAdmin,
      borrower,
      otherAccount,
      otherAccounts,
      pool,
      loan,
      liquidityAsset,
      poolController
    };
  }

  describe("setRequestFee()", () => {
    it("sets the request fee in Bps", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await poolController.connect(poolAdmin).setRequestFee(1000);

      const settings = await poolController.settings();
      expect(settings.requestFeeBps).to.equal(1000);
    });

    it("does not let anyone except the admin to set the fee", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await expect(
        poolController.connect(otherAccount).setRequestFee(10)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("does not allow setting the request fee once the pool is active", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).setRequestFee(10)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });
  });

  describe("requestFee()", () => {
    it("returns the number of shares that will be charged to make this request", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await poolController.connect(poolAdmin).setRequestFee(500); // 5%

      expect(await poolController.requestFee(1_000)).to.equal(50);
    });
  });

  describe("setWithdrawGate()", () => {
    it("sets the withdraw gate in Bps", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      const originalSettings = await poolController.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      await poolController.connect(poolAdmin).setWithdrawGate(10);

      const settings = await poolController.settings();
      expect(settings.withdrawGateBps).to.equal(10);
    });

    it("does not let anyone except the admin to set the withdraw gate", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await poolController.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      await expect(
        poolController.connect(otherAccount).setWithdrawGate(10)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("does not allow setting the request fee if the pool is paused", async () => {
      // TODO: Pause pool
    });
  });

  describe("withdrawGate()", () => {
    it("returns the current withdraw gate", async () => {
      const { poolController } = await loadFixture(loadPoolFixture);

      expect(await poolController.withdrawGate()).to.equal(10_000);
    });

    it("returns 100% if the pool is closed", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await poolController.connect(poolAdmin).setWithdrawGate(0);

      expect(await poolController.withdrawGate()).to.equal(0);

      // TODO: Close Pool
      // expect(await pool.withdrawGate()).to.equal(10_000);
    });
  });

  describe("setPoolCapacity()", () => {
    it("prevents setting capacity to less than current pool size", async () => {
      const { pool, poolController, otherAccount, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await expect(
        poolController.connect(poolAdmin).setPoolCapacity(1)
      ).to.be.revertedWith("Pool: invalid capacity");
    });

    it("allows setting pool capacity", async () => {
      const { pool, poolController, otherAccount, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await expect(
        poolController.connect(poolAdmin).setPoolCapacity(101)
      ).to.emit(poolController, "PoolSettingsUpdated");

      expect((await poolController.settings()).maxCapacity).to.equal(101);
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).setPoolCapacity(1)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("setPoolEndDate()", () => {
    it("reverts if trying to move up end date", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const newEndDate = (await poolController.settings()).endDate.add(1);

      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(newEndDate)
      ).to.be.revertedWith("Pool: can't move end date up");
    });

    it("reverts if trying to set end date to be in the past", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const now = time.latest();

      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(now)
      ).to.be.revertedWith("Pool: can't move end date into the past");
    });

    it("allows moving up the pool end date", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const newEndDate = (await poolController.settings()).endDate.sub(1);

      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(newEndDate)
      ).to.emit(poolController, "PoolSettingsUpdated");

      expect((await poolController.settings()).endDate).to.equal(newEndDate);
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).setPoolEndDate(1)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("state()", () => {
    it("is closed when pool end date passes", async () => {
      const { poolController } = await loadFixture(loadPoolFixture);

      expect(await poolController.state()).to.equal(0); // initialized

      const poolEndDate = (await poolController.settings()).endDate;
      await time.increaseTo(poolEndDate);

      expect(await poolController.state()).to.equal(3); // closed
    });
  });
  describe("depositFirstLoss()", async () => {
    it("first loss can be deposited and transitions lifecycle state", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      const { firstLossInitialMinimum: firstLossAmount } =
        await poolController.settings();

      // Grant allowance
      await liquidityAsset
        .connect(poolAdmin)
        .approve(pool.address, firstLossAmount);

      // Contribute first loss
      expect(
        await poolController
          .connect(poolAdmin)
          .depositFirstLoss(firstLossAmount, poolAdmin.address)
      ).to.emit(poolController, "FirstLossDeposited");

      // Check balance
      expect(await pool.firstLoss()).to.equal(firstLossAmount);

      // Check lifecycle
      expect(await poolController.state()).to.equal(1); // Enum values are treated as ints
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController
          .connect(otherAccount)
          .depositFirstLoss(100, otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("withdrawFirstLoss()", async () => {
    it("reverts if pool is not closed", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await expect(
        poolController
          .connect(poolAdmin)
          .withdrawFirstLoss(10, poolAdmin.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if pool is closed, but there are still active loans", async () => {
      const {
        pool,
        poolController,
        poolAdmin,
        borrower,
        loan,
        otherAccount,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward past pool close
      await time.increaseTo((await pool.settings()).endDate);
      expect(await poolController.state()).to.equal(3); // Closed

      await expect(
        poolController
          .connect(poolAdmin)
          .withdrawFirstLoss(10, poolAdmin.address)
      ).to.be.revertedWith("Pool: loans still active");
    });

    it("can withdraw first loss to a receiver", async () => {
      const {
        pool,
        poolController,
        poolAdmin,
        borrower,
        loan,
        otherAccount,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Pay down loan
      // Give borrower arbitrary amount to fully paydown loan
      const borrowerExcessAmount = (await loan.principal()).mul(2);
      await liquidityAsset.mint(borrower.address, borrowerExcessAmount);
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, borrowerExcessAmount);
      await loan.connect(borrower).completeFullPayment();

      // Fast forward to pool enddate
      await time.increaseTo(await (await pool.settings()).endDate);

      // First loss available
      const firstLossAmt = await pool.firstLoss();
      const firstLossVault = await pool.firstLossVault();
      const txn = await poolController
        .connect(poolAdmin)
        .withdrawFirstLoss(firstLossAmt, poolAdmin.address);
      await txn.wait();

      expect(txn)
        .to.emit(poolController, "FirstLossWithdrawn")
        .withArgs(poolAdmin.address, poolAdmin.address, firstLossAmt);

      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        poolAdmin.address,
        +firstLossAmt
      );
      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        firstLossVault,
        -firstLossAmt
      );
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController
          .connect(otherAccount)
          .withdrawFirstLoss(100, otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });
});
