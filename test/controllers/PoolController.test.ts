import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import {
  collateralizeLoan,
  deployLoan,
  fundLoan,
  DEFAULT_LOAN_SETTINGS
} from "../support/loan";
import { activatePool, deployPool, depositToPool } from "../support/pool";

describe("PoolController", () => {
  async function loadPoolFixture() {
    const [operator, poolAdmin, borrower, otherAccount, ...otherAccounts] =
      await ethers.getSigners();

    const {
      pool,
      liquidityAsset,
      poolController,
      serviceConfiguration,
      withdrawController
    } = await deployPool({
      operator,
      poolAdmin: poolAdmin
    });

    const { mockERC20: collateralAsset } = await deployMockERC20();

    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    const { loan: otherLoan } = await deployLoan(
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
      otherLoan,
      liquidityAsset,
      collateralAsset,
      poolController,
      withdrawController
    };
  }

  async function loadPoolFixtureWithFees() {
    const [operator, poolAdmin, otherAccount] = await ethers.getSigners();
    const { pool, poolController, liquidityAsset, serviceConfiguration } =
      await deployPool({
        operator,
        poolAdmin,
        settings: { fixedFee: 100, fixedFeeInterval: 30 }
      });

    const { loan } = await deployLoan(
      pool.address,
      otherAccount.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return {
      pool,
      poolController,
      liquidityAsset,
      poolAdmin,
      otherAccount,
      loan
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

  describe("setRequestCancellationFee()", () => {
    it("sets the request fee in Bps", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestCancellationFeeBps).to.equal(100);

      await poolController.connect(poolAdmin).setRequestCancellationFee(1000);

      const settings = await poolController.settings();
      expect(settings.requestCancellationFeeBps).to.equal(1000);
    });

    it("does not let anyone except the admin to set the fee", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestCancellationFeeBps).to.equal(100);

      await expect(
        poolController.connect(otherAccount).setRequestCancellationFee(10)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("does not allow setting the request fee once the pool is active", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestCancellationFeeBps).to.equal(100);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).setRequestCancellationFee(10)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });
  });

  describe("requestCancellationFee()", () => {
    it("returns the number of shares that will be charged to make this request", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await poolController.connect(poolAdmin).setRequestCancellationFee(500); // 5%

      expect(await poolController.requestCancellationFee(1_000)).to.equal(50);
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
      const { poolController, poolAdmin, liquidityAsset } = await loadFixture(
        loadPoolFixture
      );

      const { firstLossInitialMinimum: firstLossAmount } =
        await poolController.settings();

      // Grant allowance
      await liquidityAsset
        .connect(poolAdmin)
        .approve(poolController.address, firstLossAmount);

      // Contribute first loss
      expect(
        await poolController
          .connect(poolAdmin)
          .depositFirstLoss(firstLossAmount, poolAdmin.address)
      ).to.emit(poolController, "FirstLossDeposited");

      // Check balance
      expect(await poolController.firstLossBalance()).to.equal(firstLossAmount);

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
      await fundLoan(loan, poolController, poolAdmin);
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
      await fundLoan(loan, poolController, poolAdmin);
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
      const firstLossAmt = await poolController.firstLossBalance();
      const firstLossVault = await poolController.firstLossVault();
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

  describe("fundLoan()", () => {
    it("reverts if pool is not active", async () => {
      const { poolController, otherAccount, poolAdmin } = await loadFixture(
        loadPoolFixture
      );

      expect(await poolController.state()).to.equal(0); // initialized

      await expect(
        poolController.connect(poolAdmin).fundLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan address is not recognized", async () => {
      const { pool, poolController, liquidityAsset, otherAccount, poolAdmin } =
        await loadFixture(loadPoolFixture);

      expect(await poolController.state()).to.equal(0); // initialized
      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).fundLoan(otherAccount.address)
      ).to.be.reverted;
    });

    it("funds the loan from pool liquidity", async () => {
      const {
        pool,
        poolController,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);

      const txn = await poolController
        .connect(poolAdmin)
        .fundLoan(loan.address);

      expect(txn).to.changeTokenBalance(
        liquidityAsset,
        pool,
        -DEFAULT_LOAN_SETTINGS.principal
      );
      expect(txn).to.changeEtherBalance(
        liquidityAsset,
        loan,
        +DEFAULT_LOAN_SETTINGS.principal
      );
    });

    it("reverts if trying to fund loan with withdrawal-earmarked funds", async () => {
      const {
        pool,
        poolController,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal * 2
      );

      // Now request withdraw
      const redeemAmount = await pool.maxRedeemRequest(otherAccount.address);
      await pool.connect(otherAccount).requestRedeem(redeemAmount);

      // fast forward and crank
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);
      await pool.crank();

      // double check that the funds are now available for withdraw
      expect(await pool.maxRedeem(otherAccount.address)).to.equal(
        redeemAmount - 2
      );

      // check that totalAvailableAssets is dust
      expect(await pool.totalAvailableAssets()).to.lessThan(10);

      // Check that there is technically enough funds to cover the loan
      expect(await liquidityAsset.balanceOf(pool.address)).is.greaterThan(
        await loan.principal()
      );

      // ...but that the pool won't allow it
      await expect(
        poolController.connect(poolAdmin).fundLoan(loan.address)
      ).to.be.revertedWith("Pool: not enough assets");
    });

    it("reverts if trying to fund loan with liquidity already deployed", async () => {
      const {
        pool,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan,
        otherLoan,
        poolController
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal * 1.5
      );

      // fund first loan
      expect(await pool.totalAvailableAssets()).to.equal(
        DEFAULT_LOAN_SETTINGS.principal * 1.5
      );
      await fundLoan(loan, poolController, poolAdmin);

      // total value locked by the Pool is the same, since the funds just shifted to the loan
      expect(await pool.totalAvailableAssets()).to.equal(
        DEFAULT_LOAN_SETTINGS.principal * 1.5
      );

      // confirm that funding a new loan will fail
      await expect(
        poolController.connect(poolAdmin).fundLoan(otherLoan.address)
      ).to.be.revertedWith("Pool: not enough assets");
    });

    it("reverts if not called by Pool Controller", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).fundLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("defaultLoan()", () => {
    it("reverts if Pool state is initialized", async () => {
      const { poolController, poolAdmin, loan } = await loadFixture(
        loadPoolFixture
      );
      await expect(
        poolController.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan if Pool hasn't funded loan yet", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset, loan } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);
      await expect(
        poolController.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: not active loan");
    });

    it("defaults loan if loan is active, and pool is active", async () => {
      const {
        collateralAsset,
        pool,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount,
        poolController
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Collateralize loan
      await collateralizeLoan(loan, borrower, collateralAsset);

      // Deposit to pool and fund loan
      const loanPrincipal = await loan.principal();
      await depositToPool(pool, otherAccount, liquidityAsset, loanPrincipal);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Confirm that pool liquidity reserve is now empty
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(0);

      // Get an accounting snapshot prior to the default
      const outstandingLoanPrincipalsBefore = (await pool.accountings())
        .outstandingLoanPrincipals;
      const firstLossAvailable = await poolController.firstLossBalance();

      // Expected loan outstanding stand = principal + numberPayments * payments
      const loanPaymentsRemaining = await loan.paymentsRemaining();
      const loanPaymentAmount = await loan.payment();
      const loanOustandingDebt = loanPrincipal.add(
        loanPaymentsRemaining.mul(loanPaymentAmount)
      );

      // Confirm that first loss is NOT enough to cover the outstanding loan debt
      expect(firstLossAvailable).to.be.lessThan(loanOustandingDebt);

      // Trigger default
      // Since first-loss is not enough to cover outstanding debt, all of it is used
      await expect(poolController.connect(poolAdmin).defaultLoan(loan.address))
        .to.emit(poolController, "LoanDefaulted")
        .withArgs(loan.address)
        .to.emit(poolController, "FirstLossApplied")
        .withArgs(
          loan.address,
          firstLossAvailable,
          loanOustandingDebt.sub(firstLossAvailable)
        );

      // Check accountings after
      // Pool accountings should be updated
      expect((await pool.accountings()).outstandingLoanPrincipals).is.equal(
        outstandingLoanPrincipalsBefore.sub(loanPrincipal)
      );

      // First loss vault should be empty
      expect(await poolController.firstLossBalance()).to.equal(0);

      // Pool liquidity reserve should now contain the first loss
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(
        firstLossAvailable
      );
    });

    it("Allows defaults even if pool is closed", async () => {
      const {
        collateralAsset,
        pool,
        poolController,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, collateralAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward to pool end date
      await time.increaseTo((await pool.settings()).endDate);
      expect(await pool.state()).to.equal(3); // Closed

      // Default should proceed
      await expect(poolController.connect(poolAdmin).defaultLoan(loan.address))
        .not.to.be.reverted;
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).defaultLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("crank()", () => {
    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).crank()
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("cranks the pool", async () => {
      const { poolController, pool, poolAdmin, liquidityAsset } =
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

  describe("fixed fees", () => {
    it("claiming fees is only available to the pool admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixtureWithFees
      );

      const tx = poolController.connect(otherAccount).claimFixedFee();
      await expect(tx).to.be.revertedWith("Pool: caller is not admin");
    });

    it("cannot claim fees until they're due", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);
      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.revertedWith("Pool: fixed fee not due");
    });

    it("can claim fees when they're due", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 30 days
      await time.increase(30 * 96_400);

      // Claim Fees
      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);

      // Trying again will fail
      const tx2 = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx2).to.be.revertedWith("Pool: fixed fee not due");
    });

    it("can cumulatively claim fees when they're due", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 60 days
      await time.increase(60 * 96_400);

      // Claim Fees
      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);

      const tx2 = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx2).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);
    });
  });
});
