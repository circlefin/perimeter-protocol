import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployPool,
  DEFAULT_POOL_SETTINGS,
  depositToPool,
  activatePool
} from "./support/pool";
import { deployLoan, collateralizeLoan, fundLoan } from "./support/loan";

describe("Pool", () => {
  async function loadPoolFixture() {
    const [operator, poolManager, borrower, otherAccount, ...otherAccounts] =
      await ethers.getSigners();
    const { pool, liquidityAsset, serviceConfiguration } = await deployPool({
      operator,
      poolAdmin: poolManager
    });

    const CollateralAsset = await ethers.getContractFactory("MockERC20");
    const collateralAsset = await CollateralAsset.deploy("Test Coin", "TC", 18);
    await collateralAsset.deployed();

    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return {
      pool,
      collateralAsset,
      liquidityAsset,
      poolManager,
      borrower,
      otherAccount,
      loan,
      otherAccounts
    };
  }

  async function loadPoolFixtureWithFees() {
    const [operator, poolManager, otherAccount] = await ethers.getSigners();
    const settings = Object.assign({}, DEFAULT_POOL_SETTINGS);
    settings.fixedFee = 100;
    settings.fixedFeeInterval = 30;
    const { pool, liquidityAsset, serviceConfiguration } = await deployPool({
      operator,
      poolAdmin: poolManager,
      settings
    });

    const { loan } = await deployLoan(
      pool.address,
      otherAccount.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return { pool, liquidityAsset, poolManager, otherAccount, loan };
  }

  async function loanPoolFixtureWithMaturedLoan() {
    const { pool, otherAccount, borrower, liquidityAsset, poolManager, loan } =
      await loadFixture(loadPoolFixture);

    await activatePool(pool, poolManager, liquidityAsset);

    await liquidityAsset.connect(otherAccount).approve(pool.address, 1_000_000);

    await depositToPool(pool, otherAccount, liquidityAsset, 1_000_000);
    await collateralizeLoan(loan, borrower, liquidityAsset);
    await fundLoan(loan, pool, poolManager);
    await loan.connect(borrower).drawdown(await loan.principal());

    await liquidityAsset.connect(borrower).approve(loan.address, 2_000_000);
    await liquidityAsset.approve(loan.address, 2_000_000);
    await liquidityAsset.mint(borrower.address, 200_000);
    await loan.connect(borrower).completeFullPayment();

    return { pool, otherAccount, loan, borrower, liquidityAsset };
  }

  describe("lifeCycleState()", () => {
    it("is closed when pool end date passes", async () => {
      const { pool } = await loadFixture(loadPoolFixture);

      expect(await pool.lifeCycleState()).to.equal(0); // initialized

      const poolEndDate = (await pool.settings()).endDate;
      await time.increaseTo(poolEndDate);

      expect(await pool.lifeCycleState()).to.equal(3); // closed
    });
  });

  describe("setRequestFee()", () => {
    it("sets the request fee in Bps", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      const originalSettings = await pool.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await pool.connect(poolManager).setRequestFee(1000);

      const settings = await pool.settings();
      expect(settings.requestFeeBps).to.equal(1000);
    });

    it("does not let anyone except the manager to set the fee", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      const originalSettings = await pool.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await expect(
        pool.connect(otherAccount).setRequestFee(10)
      ).to.be.revertedWith("Pool: caller is not manager");
    });

    it("does not allow setting the request fee once the pool is active", async () => {
      const { pool, poolManager, liquidityAsset } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await pool.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await activatePool(pool, poolManager, liquidityAsset);

      await expect(
        pool.connect(poolManager).setRequestFee(10)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });
  });

  describe("setWithdrawGate()", () => {
    it("sets the withdraw gate in Bps", async () => {
      const { pool, poolManager, liquidityAsset } = await loadFixture(
        loadPoolFixture
      );
      await activatePool(pool, poolManager, liquidityAsset);

      const originalSettings = await pool.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      await pool.connect(poolManager).setWithdrawGate(10);

      const settings = await pool.settings();
      expect(settings.withdrawGateBps).to.equal(10);
    });

    it("does not let anyone except the manager to set the withdraw gate", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      const originalSettings = await pool.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      await expect(
        pool.connect(otherAccount).setWithdrawGate(10)
      ).to.be.revertedWith("Pool: caller is not manager");
    });

    it("does not allow setting the request fee if the pool is paused", async () => {
      // TODO: Pause pool
    });
  });

  describe("withdrawGate()", () => {
    it("returns the current withdraw gate", async () => {
      const { pool } = await loadFixture(loadPoolFixture);

      expect(await pool.withdrawGate()).to.equal(10_000);
    });

    it("returns 100% if the pool is closed", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      await pool.connect(poolManager).setWithdrawGate(0);
      expect(await pool.withdrawGate()).to.equal(0);

      // TODO: Close Pool
      // expect(await pool.withdrawGate()).to.equal(10_000);
    });
  });

  describe("depositFirstLoss()", async () => {
    it("first loss can be deposited and transitions lifecycle state", async () => {
      const { pool, poolManager, liquidityAsset } = await loadFixture(
        loadPoolFixture
      );

      const { firstLossInitialMinimum: firstLossAmount } =
        await pool.settings();

      // Grant allowance
      await liquidityAsset
        .connect(poolManager)
        .approve(pool.address, firstLossAmount);

      // Contribute first loss
      expect(
        await pool
          .connect(poolManager)
          .depositFirstLoss(firstLossAmount, poolManager.address)
      ).to.emit(pool.address, "FirstLossDeposited");

      // Check balance
      expect(await pool.firstLoss()).to.equal(firstLossAmount);

      // Check lifecycle
      expect(await pool.lifeCycleState()).to.equal(1); // Enum values are treated as ints
    });
  });

  describe("withdrawFirstLoss()", async () => {
    it("reverts if pool is not closed", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      await expect(
        pool.connect(poolManager).withdrawFirstLoss(10, poolManager.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if pool is closed, but there are still active loans", async () => {
      const {
        pool,
        poolManager,
        borrower,
        loan,
        otherAccount,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward past pool close
      await time.increaseTo((await pool.settings()).endDate);
      expect(await pool.lifeCycleState()).to.equal(3); // Closed

      await expect(
        pool.connect(poolManager).withdrawFirstLoss(10, poolManager.address)
      ).to.be.revertedWith("Pool: loans still active");
    });

    it("can withdraw first loss to a receiver", async () => {
      const {
        pool,
        poolManager,
        borrower,
        loan,
        otherAccount,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
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
      const txn = await pool
        .connect(poolManager)
        .withdrawFirstLoss(firstLossAmt, poolManager.address);
      await txn.wait();

      expect(txn)
        .to.emit(pool, "FirstLossWithdrawn")
        .withArgs(poolManager.address, poolManager.address, firstLossAmt);

      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        poolManager.address,
        +firstLossAmt
      );
      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        firstLossVault,
        -firstLossAmt
      );
    });
  });

  describe("deposit()", async () => {
    it("deposit cannot be called if pool is initialized", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      expect(await pool.lifeCycleState()).to.equal(0); // initialized

      await expect(
        pool.connect(otherAccount).deposit(100, otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("depositing mints shares to receiver", async () => {
      const { pool, otherAccount, liquidityAsset, poolManager } =
        await loadFixture(loadPoolFixture);

      const { firstLossInitialMinimum } = await pool.settings();

      // First loss must be provided for deposits to open
      await liquidityAsset
        .connect(poolManager)
        .approve(pool.address, firstLossInitialMinimum);

      // Contribute first loss
      await pool
        .connect(poolManager)
        .depositFirstLoss(
          DEFAULT_POOL_SETTINGS.firstLossInitialMinimum,
          poolManager.address
        );

      // Provide capital to lender
      const depositAmount = 1000;
      await liquidityAsset.mint(otherAccount.address, depositAmount);

      // Approve the deposit
      await liquidityAsset
        .connect(otherAccount)
        .approve(pool.address, depositAmount);

      // Deposit
      await expect(
        pool.connect(otherAccount).deposit(depositAmount, otherAccount.address)
      ).to.emit(pool, "Deposit");

      // Check that shares were received, 1:1 to the liquidity as first lender
      expect(await pool.balanceOf(otherAccount.address)).to.equal(
        depositAmount
      );
    });
  });

  describe("mint()", async () => {
    it("mint cannot be called if pool is initialized", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      expect(await pool.lifeCycleState()).to.equal(0); // initialized

      await expect(
        pool.connect(otherAccount).mint(100, otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("minting mints shares to receiver", async () => {
      const { pool, otherAccount, liquidityAsset, poolManager } =
        await loadFixture(loadPoolFixture);

      const { firstLossInitialMinimum } = await pool.settings();

      // First loss must be provided for deposits to open
      await liquidityAsset
        .connect(poolManager)
        .approve(pool.address, firstLossInitialMinimum);

      // Contribute first loss
      await pool
        .connect(poolManager)
        .depositFirstLoss(
          DEFAULT_POOL_SETTINGS.firstLossInitialMinimum,
          poolManager.address
        );

      // Provide capital to lender
      const depositAmount = 1000;
      await liquidityAsset.mint(otherAccount.address, depositAmount);

      // Approve the deposit
      await liquidityAsset
        .connect(otherAccount)
        .approve(pool.address, depositAmount);

      // Deposit
      await expect(
        pool.connect(otherAccount).mint(depositAmount, otherAccount.address)
      ).to.emit(pool, "Deposit");

      // Check that shares were received, 1:1 to the liquidity as first lender
      expect(await pool.balanceOf(otherAccount.address)).to.equal(
        depositAmount
      );
    });
  });

  describe("defaultLoan()", () => {
    it("reverts if Pool state is initialized", async () => {
      const { pool, poolManager, loan } = await loadFixture(loadPoolFixture);
      await expect(
        pool.connect(poolManager).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan if Pool hasn't funded loan yet", async () => {
      const { pool, poolManager, liquidityAsset, loan } = await loadFixture(
        loadPoolFixture
      );
      await activatePool(pool, poolManager, liquidityAsset);
      await expect(
        pool.connect(poolManager).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: unfunded loan");
    });

    it("defaults loan if loan is active, and pool is active", async () => {
      const {
        collateralAsset,
        pool,
        poolManager,
        liquidityAsset,
        loan,
        borrower,
        otherAccount
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolManager, liquidityAsset);

      // Collateralize loan
      await collateralizeLoan(loan, borrower, collateralAsset);

      // Deposit to pool and fund loan
      const loanPrincipal = await loan.principal();
      await depositToPool(pool, otherAccount, liquidityAsset, loanPrincipal);
      await fundLoan(loan, pool, poolManager);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Confirm that pool liquidity reserve is now empty
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(0);

      // Get an accounting snapshot prior to the default
      const outstandingLoanPrincipalsBefore = (await pool.accountings())
        .outstandingLoanPrincipals;
      const firstLossAvailable = await pool.firstLoss();

      // Expected loan outstanding stand = principal + numberPayments * payments
      const loanPaymentsRemaining = await loan.paymentsRemaining();
      const loanPaymentAmount = await loan.payment();
      const loanOustandingDebt = loanPrincipal.add(
        loanPaymentsRemaining.mul(loanPaymentAmount)
      );

      // Confirm that first loss is NOT enough to cover the oustanding loan debt
      expect(firstLossAvailable).to.be.lessThan(loanOustandingDebt);

      // Trigger default
      // Since first-loss is not enough to cover oustanding debt, all of it is used
      await expect(pool.connect(poolManager).defaultLoan(loan.address))
        .to.emit(pool, "LoanDefaulted")
        .withArgs(loan.address)
        .to.emit(pool, "FirstLossApplied")
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
      expect(await pool.firstLoss()).to.equal(0);

      // Pool liquidity reserve should now contain the first loss
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(
        firstLossAvailable
      );
    });

    it("Allows defaults even if pool is closed", async () => {
      const {
        collateralAsset,
        pool,
        poolManager,
        liquidityAsset,
        loan,
        borrower,
        otherAccount
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await collateralizeLoan(loan, borrower, collateralAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await fundLoan(loan, pool, poolManager);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward to pool end date
      await time.increaseTo((await pool.settings()).endDate);
      expect(await pool.lifeCycleState()).to.equal(3); // Closed

      // Default should proceed
      await expect(pool.connect(poolManager).defaultLoan(loan.address)).not.to
        .be.reverted;
    });
  });

  describe("previewDeposit()", async () => {
    it("includes interest when calculating deposit exchange rate", async () => {
      const lender = (await ethers.getSigners())[10];
      const {
        collateralAsset,
        pool,
        poolManager,
        liquidityAsset,
        loan,
        borrower
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await collateralizeLoan(loan, borrower, collateralAsset);

      // setup lender
      const loanAmount = await loan.principal();
      const depositAmount = loanAmount.mul(2);
      await liquidityAsset.mint(lender.address, depositAmount);
      await liquidityAsset
        .connect(lender)
        .increaseAllowance(pool.address, depositAmount);

      // Deposit initial amount to pool and fund the loan
      const depositPreviewBefore = await pool
        .connect(lender)
        .previewDeposit(loanAmount);
      expect(depositPreviewBefore).to.equal(loanAmount).to.equal(1_000_000); // 1:1

      // Deposit and fund / drawdown loan
      await depositToPool(pool, lender, liquidityAsset, loanAmount);
      await fundLoan(loan, pool, poolManager);
      await loan.connect(borrower).drawdown(await loan.principal());
      const drawdownTime = await time.latest();

      // Fast forward to halfway through 1st payment term
      const halfwayThroughFirstTermSeconds = (await loan.paymentPeriod())
        .mul(86400)
        .div(2)
        .add(drawdownTime);
      await time.increaseTo(halfwayThroughFirstTermSeconds);
      const depositPreviewAfter = await pool
        .connect(lender)
        .previewDeposit(loanAmount);

      // Expect this to be less than before
      await expect(depositPreviewAfter)
        .to.be.lessThan(depositPreviewBefore)
        .to.equal(997921);
    });
  });

  describe("updatePoolCapacity()", () => {
    it("prevents setting capacity to less than current pool size", async () => {
      const { pool, otherAccount, poolManager, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await expect(
        pool.connect(poolManager).updatePoolCapacity(1)
      ).to.be.revertedWith("Pool: invalid capacity");
    });

    it("allows setting pool capacity", async () => {
      const { pool, otherAccount, poolManager, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await expect(pool.connect(poolManager).updatePoolCapacity(101)).to.emit(
        pool,
        "PoolSettingsUpdated"
      );

      expect((await pool.settings()).maxCapacity).to.equal(101);
    });
  });

  describe("Rounding", async () => {
    describe("convertToAssets()", () => {
      it("rounds down", async () => {
        const { pool } = await loanPoolFixtureWithMaturedLoan();
        expect(await pool.convertToAssets(1000)).to.equal(1023); // 1023.747 rounded DOWN
      });
    });

    describe("convertToShares()", () => {
      it("rounds down", async () => {
        const { pool } = await loanPoolFixtureWithMaturedLoan();
        expect(await pool.convertToShares(1000)).to.equal(976); // 976.804 rounded DOWN
      });
    });

    describe("previewDeposit()", () => {
      it("rounds down", async () => {
        const { pool } = await loanPoolFixtureWithMaturedLoan();
        expect(await pool.previewDeposit(1000)).to.equal(976); // 976.804 rounded DOWN
      });
    });

    describe("previewMint()", () => {
      it("rounds up", async () => {
        const { pool } = await loanPoolFixtureWithMaturedLoan();
        expect(await pool.previewMint(1000)).to.equal(1024); // 1023.747 rounded UP
      });
    });

    describe("mint()", () => {
      it("rounds up", async () => {
        const { pool, liquidityAsset, otherAccount } =
          await loanPoolFixtureWithMaturedLoan();
        await liquidityAsset.connect(otherAccount).approve(pool.address, 1024);
        await liquidityAsset.mint(otherAccount.address, 1024);

        const txn = await pool
          .connect(otherAccount)
          .mint(1000, otherAccount.address);
        expect(txn).to.changeTokenBalance(
          liquidityAsset,
          otherAccount.address,
          -1024
        ); // 1023.747 rounded UP
      });
    });

    describe("deposit()", () => {
      it("rounds down", async () => {
        const { pool, otherAccount, liquidityAsset } =
          await loanPoolFixtureWithMaturedLoan();
        await liquidityAsset.connect(otherAccount).approve(pool.address, 1000);
        await liquidityAsset.mint(otherAccount.address, 1000);

        const txn = await pool
          .connect(otherAccount)
          .deposit(1000, otherAccount.address);
        expect(txn).to.changeTokenBalance(pool, otherAccount, +976); // 976.804 rounded DOWN
      });
    });
  });

  describe("updatePoolEndDate()", () => {
    it("reverts if trying to move up end date", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      const newEndDate = (await pool.settings()).endDate.add(1);

      await expect(
        pool.connect(poolManager).updatePoolEndDate(newEndDate)
      ).to.be.revertedWith("Pool: can't move end date up");
    });

    it("reverts if trying to set end date to be in the past", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      const now = time.latest();

      await expect(
        pool.connect(poolManager).updatePoolEndDate(now)
      ).to.be.revertedWith("Pool: can't move end date into the past");
    });

    it("allows moving up the pool end date", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      const newEndDate = (await pool.settings()).endDate.sub(1);

      await expect(
        pool.connect(poolManager).updatePoolEndDate(newEndDate)
      ).to.emit(pool, "PoolSettingsUpdated");
      expect((await pool.settings()).endDate).to.equal(newEndDate);
    });
  });

  describe("Permissions", () => {
    describe("updatePoolCapacity()", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).updatePoolCapacity(1)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("updatePoolEndDate()", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).updatePoolEndDate(1)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("fundLoan()", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).fundLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not manager");
      });

      it("reverts if pool is not active", async () => {
        const { pool, otherAccount, poolManager } = await loadFixture(
          loadPoolFixture
        );

        expect(await pool.lifeCycleState()).to.equal(0); // initialized

        await expect(
          pool.connect(poolManager).fundLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
      });

      it("reverts if loan address is not recognized", async () => {
        const { pool, liquidityAsset, otherAccount, poolManager } =
          await loadFixture(loadPoolFixture);

        expect(await pool.lifeCycleState()).to.equal(0); // initialized
        await activatePool(pool, poolManager, liquidityAsset);

        await expect(pool.connect(poolManager).fundLoan(otherAccount.address))
          .to.be.reverted;
      });
    });

    describe("defaultLoan()", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).defaultLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("depositFirstLoss()", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).depositFirstLoss(100, otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("withdrawFirstLoss()", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool
            .connect(otherAccount)
            .withdrawFirstLoss(100, otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });
  });

  describe("transfer()", async () => {
    it("transfers are disabled", async () => {
      const { pool, poolManager, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      pool.mint(10, poolManager.address);
      await expect(
        pool.connect(poolManager).transfer(otherAccount.address, 10)
      ).to.be.revertedWith("Pool: transfers disabled");
    });

    it("transfer to zero address is denied", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      pool.mint(10, poolManager.address);
      await expect(
        pool.connect(poolManager).transfer(ethers.constants.AddressZero, 10)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("transferFrom()", async () => {
    it("transfers are disabled", async () => {
      const { pool, poolManager, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      pool.mint(10, poolManager.address);
      pool.connect(poolManager).approve(otherAccount.address, 10);
      await expect(
        pool
          .connect(otherAccount)
          .transferFrom(poolManager.address, otherAccount.address, 10)
      ).to.be.revertedWith("Pool: transfers disabled");
    });

    it("transfer to zero address is denied", async () => {
      const { pool, poolManager, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      pool.mint(10, poolManager.address);
      pool.connect(poolManager).approve(otherAccount.address, 10);
      await expect(
        pool
          .connect(otherAccount)
          .transferFrom(poolManager.address, ethers.constants.AddressZero, 10)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("Withdrawal Requests", () => {
    describe("withdrawPeriod()", () => {
      it("returns the first period when the pool is not yet initialized", async () => {
        const { pool } = await loadFixture(loadPoolFixture);

        expect(await pool.withdrawPeriod()).to.equal(0);
      });

      it("returns the first period when the pool is activated", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolManager, liquidityAsset);

        expect(await pool.withdrawPeriod()).to.equal(0);
      });

      it("returns the second period when the first period has ended", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolManager, liquidityAsset);

        const { withdrawRequestPeriodDuration } = await pool.settings();
        await time.increase(withdrawRequestPeriodDuration);

        expect(await pool.withdrawPeriod()).to.equal(1);
      });
    });

    describe("requestFee()", () => {
      it("returns the number of shares that will be charged to make this request", async () => {
        const { pool, poolManager } = await loadFixture(loadPoolFixture);

        await pool.connect(poolManager).setRequestFee(500); // 5%

        expect(await pool.requestFee(1_000)).to.equal(50);
      });
    });

    describe("maxRedeemRequest()", () => {
      it("returns the current number of shares minus fees if no requests have been made", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(
          await pool
            .connect(otherAccount)
            .maxRedeemRequest(otherAccount.address)
        ).to.equal(95);
      });

      it("returns the current number of shares minus existing requests and fees if any", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestRedeem(51);

        expect(
          await pool
            .connect(otherAccount)
            .maxRedeemRequest(otherAccount.address)
        ).to.equal(43);
      });

      it("returns 0 if the requested balance is > what is available", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        const max = await pool.maxRedeemRequest(otherAccount.address);
        await pool.connect(otherAccount).requestRedeem(max);

        expect(
          await pool
            .connect(otherAccount)
            .maxRedeemRequest(otherAccount.address)
        ).to.equal(0);
      });

      it("allows calling this method to check another lender", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestRedeem(51);

        expect(await pool.maxRedeemRequest(otherAccount.address)).to.equal(43);
      });
    });

    describe("previewRedeemRequest", () => {
      it("returns the number of assets, minus fees, rounded down, that would be transferred in this redeem request, regardless of caller balance", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await pool.connect(poolManager).setRequestFee(1000); // 10%
        await activatePool(pool, poolManager, liquidityAsset);

        // TODO: Show a non 1:1 share value
        expect(await pool.previewRedeemRequest(27)).to.equal(24);
      });
    });

    describe("requestRedeem()", () => {
      it("reverts if the pool is not active", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).requestRedeem(100)
        ).to.be.revertedWith("Pool: PoolNotActive");
      });

      it("reverts if the lender has a zero balance", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolManager, liquidityAsset);

        await expect(pool.requestRedeem(100)).to.be.revertedWith(
          "Pool: caller is not a lender"
        );
      });

      it("reverts if the lender is requesting to redeem more than their balance", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        const balance = await pool.balanceOf(otherAccount.address);

        await expect(
          pool.connect(otherAccount).requestWithdraw(balance.add(1))
        ).to.be.revertedWith("Pool: InsufficientBalance");
      });

      it("performs a redeem request, paying the fee", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(100);

        // TODO: Show a non 1:1 share value
        await pool.connect(otherAccount).requestRedeem(50);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(97);
      });

      it("emits a RedeemRequested event if the lender requests a valid amount", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        const max = await pool.maxRedeemRequest(otherAccount.address);

        expect(await pool.connect(otherAccount).requestRedeem(max))
          .to.emit(pool.address, "RedeemRequested")
          .withArgs(otherAccount.address, max);
      });
    });

    describe("maxWithdrawRequest(address)", () => {
      it("returns the current number of assets minus fees if no requests have been made", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(
          await pool
            .connect(otherAccount)
            .maxWithdrawRequest(otherAccount.address)
        ).to.equal(95);
      });

      it("returns the current number of assets minus existing requests and fees if any", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestWithdraw(51);

        expect(
          await pool
            .connect(otherAccount)
            .maxWithdrawRequest(otherAccount.address)
        ).to.equal(44);
      });

      it("returns 0 if the requested balance is > what is available", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        const max = await pool.maxWithdrawRequest(otherAccount.address);
        await pool.connect(otherAccount).requestWithdraw(max);

        expect(
          await pool
            .connect(otherAccount)
            .maxWithdrawRequest(otherAccount.address)
        ).to.equal(0);
      });

      it("allows calling this method to check another lender", async () => {
        const { pool, poolManager, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestWithdraw(51);

        expect(await pool.maxWithdrawRequest(otherAccount.address)).to.equal(
          44
        );
      });
    });

    describe("previewWithdrawRequest(assets)", () => {
      it("returns the share value of the provided assets, minus fees, regardless of caller balance", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await pool.connect(poolManager).setRequestFee(1000); // 10%
        await activatePool(pool, poolManager, liquidityAsset);

        // TODO: Show a non 1:1 share value
        expect(await pool.previewWithdrawRequest(27)).to.equal(30);
      });
    });

    describe("requestWithdraw()", () => {
      it("reverts if the pool is not active", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).requestWithdraw(100)
        ).to.be.revertedWith("Pool: PoolNotActive");
      });

      it("reverts if the lender has a zero balance", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolManager, liquidityAsset);

        await expect(pool.requestWithdraw(100)).to.be.revertedWith(
          "Pool: caller is not a lender"
        );
      });

      it("reverts if the lender is requesting to withdraw more than their balance", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await expect(
          pool.connect(otherAccount).requestWithdraw(101)
        ).to.be.revertedWith("Pool: InsufficientBalance");
      });

      it("performs a withdraw request, paying the fee", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(100);

        // TODO: Show a non 1:1 share value
        await pool.connect(otherAccount).requestWithdraw(50);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(97);
      });

      it("emits a WithdrawRequested event if the lender requests a valid amount", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        const max = await pool.maxWithdrawRequest(otherAccount.address);

        expect(await pool.connect(otherAccount).requestWithdraw(max))
          .to.emit(pool.address, "WithdrawRequested")
          .withArgs(otherAccount.address, max);
      });
    });

    describe("interestBearingBalanceOf()", () => {
      it("returns the number of shares minus the amount of redeemable shares", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(
          await pool.interestBearingBalanceOf(otherAccount.address)
        ).to.equal(100);

        await pool.connect(otherAccount).requestRedeem(50);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await time.increase(withdrawRequestPeriodDuration);

        await pool.connect(poolManager).crank();

        const balance = await pool.balanceOf(otherAccount.address);
        const redeemable = await pool.maxRedeem(otherAccount.address);

        expect(
          await pool.interestBearingBalanceOf(otherAccount.address)
        ).to.equal(47);
        expect(
          await pool.interestBearingBalanceOf(otherAccount.address)
        ).to.equal(balance.sub(redeemable));
      });
    });

    describe("requestedBalanceOf()", () => {
      it("returns the requested, but not yet eligible number of shares for a given lender", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(50);

        expect(await pool.requestedBalanceOf(otherAccount.address)).to.equal(
          50
        );
      });
    });

    describe("totalRequestedBalance()", () => {
      it("returns the requested, but not yet eligible number of shares in this pool", async () => {
        const {
          pool,
          poolManager,
          liquidityAsset,
          otherAccount,
          otherAccounts
        } = await loadFixture(loadPoolFixture);

        const bob = otherAccounts[0];
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await depositToPool(pool, bob, liquidityAsset, 200);
        await pool.connect(otherAccount).requestRedeem(50);
        await pool.connect(bob).requestRedeem(120);

        expect(await pool.totalRequestedBalance()).to.equal(170);
      });
    });

    describe("eligibleBalanceOf()", () => {
      it("returns the eligible number of shares for a given lender", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(50);

        expect(await pool.eligibleBalanceOf(otherAccount.address)).to.equal(0);

        await time.increase(withdrawRequestPeriodDuration);

        expect(await pool.eligibleBalanceOf(otherAccount.address)).to.equal(50);
      });
    });

    describe("totalEligibleBalance()", () => {
      it("returns the eligible number of shares in this pool", async () => {
        const {
          pool,
          poolManager,
          liquidityAsset,
          otherAccount,
          otherAccounts
        } = await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        const bob = otherAccounts[0];
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await depositToPool(pool, bob, liquidityAsset, 200);
        await pool.connect(otherAccount).requestRedeem(50);
        await pool.connect(bob).requestRedeem(120);

        expect(await pool.totalEligibleBalance()).to.equal(0);

        await time.increase(withdrawRequestPeriodDuration);

        expect(await pool.totalEligibleBalance()).to.equal(170);
      });
    });

    describe("maxRedeem()", () => {
      it("returns the redeemable number of shares for a given lender", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(10);

        await time.increase(withdrawRequestPeriodDuration);
        await pool.connect(poolManager).crank();

        expect(await pool.maxRedeem(otherAccount.address)).to.equal(10);
      });
    });

    describe("totalRedeemableShares()", () => {
      it("returns the redeemable number of shares in this pool", async () => {
        const {
          pool,
          poolManager,
          liquidityAsset,
          otherAccount,
          otherAccounts
        } = await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolManager, liquidityAsset);
        const bob = otherAccounts[0];

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(10);
        await depositToPool(pool, bob, liquidityAsset, 100);
        await pool.connect(bob).requestRedeem(30);

        // before the crank, check that redeemableShares is zero
        expect(await pool.connect(bob).totalRedeemableShares()).to.equal(0);

        await time.increase(withdrawRequestPeriodDuration);
        await pool.connect(poolManager).crank();

        expect(await pool.totalRedeemableShares()).to.equal(40); // 30 + 10

        // redeem, and see that it's decremented
        await pool.connect(bob).redeem(30, bob.address, bob.address);
        expect(await pool.totalRedeemableShares()).to.equal(10); // other account needs to redeem

        await pool
          .connect(otherAccount)
          .redeem(10, otherAccount.address, otherAccount.address);
        expect(await pool.totalRedeemableShares()).to.equal(0);
      });
    });

    describe("maxWithdraw()", () => {
      it("returns the withdrawable number of shares for a given lender", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(10);

        await time.increase(withdrawRequestPeriodDuration);
        await pool.connect(poolManager).crank();

        expect(await pool.maxWithdraw(otherAccount.address)).to.equal(10);
      });
    });

    describe("totalWithdrawableAssets()", () => {
      it("returns the withdrawable number of shares in this pool", async () => {
        const {
          pool,
          poolManager,
          liquidityAsset,
          otherAccount,
          otherAccounts
        } = await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolManager, liquidityAsset);
        const bob = otherAccounts[0];

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(10);
        await depositToPool(pool, bob, liquidityAsset, 100);
        await pool.connect(bob).requestRedeem(30);

        await time.increase(withdrawRequestPeriodDuration);
        await pool.connect(poolManager).crank();

        expect(await pool.totalWithdrawableAssets()).to.equal(40);

        // Redeem, expect it to decrement
        await pool
          .connect(otherAccount)
          .redeem(10, otherAccount.address, otherAccount.address);
        expect(await pool.totalWithdrawableAssets()).to.equal(30);

        await pool.connect(bob).redeem(30, bob.address, bob.address);
        expect(await pool.totalWithdrawableAssets()).to.equal(0);
      });
    });
  });

  describe("previewRedeem()", () => {
    it("returns the number of assets that will be returned if the requested shares were available on the current block", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolManager, liquidityAsset);

      expect(await pool.connect(otherAccount).previewRedeem(100)).to.equal(100);
    });
  });

  describe("redeem()", () => {
    it("burns shares and transfers assets", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolManager, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolManager).crank();

      const startingShares = await pool.balanceOf(otherAccount.address);
      const startingAssets = await liquidityAsset.balanceOf(
        otherAccount.address
      );
      expect(await pool.maxRedeem(otherAccount.address)).to.equal(10);

      await pool
        .connect(otherAccount)
        .redeem(10, otherAccount.address, otherAccount.address);

      expect(await liquidityAsset.balanceOf(otherAccount.address)).to.equal(
        startingAssets.add(10)
      );
      expect(await pool.balanceOf(otherAccount.address)).to.equal(
        startingShares.sub(10)
      );
    });

    it("reverts if the number of shares is too large", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolManager, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolManager).crank();

      const max = await pool.maxRedeem(otherAccount.address);

      await expect(
        pool
          .connect(otherAccount)
          .redeem(max.add(1), otherAccount.address, otherAccount.address)
      ).to.be.revertedWith("Pool: InsufficientBalance");
    });

    it("reverts if receiver !== owner", async () => {
      const { pool, otherAccount, otherAccounts } = await loadFixture(
        loadPoolFixture
      );

      const alice = otherAccounts[0];

      await expect(
        pool
          .connect(otherAccount)
          .redeem(10, otherAccount.address, alice.address)
      ).to.be.revertedWith("Pool: Withdrawal to unrelated address");
    });

    it("reverts receiver is not msg.sender", async () => {
      const { pool, otherAccount, otherAccounts } = await loadFixture(
        loadPoolFixture
      );

      const alice = otherAccounts[0];

      await expect(
        pool.connect(otherAccount).redeem(10, alice.address, alice.address)
      ).to.be.revertedWith("Pool: Must transfer to msg.sender");
    });

    it("redeems the maxReedable amount", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolManager, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 1000);

      // Check that lender now has 1000 pool tokens and no USDC
      expect(await pool.balanceOf(otherAccount.address)).to.equal(1000);
      expect(await liquidityAsset.balanceOf(otherAccount.address)).to.equal(0);
      // Check that the pool has 1000 in USDC
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(1000);

      // Request redeem
      await pool
        .connect(otherAccount)
        .requestRedeem(await pool.maxRedeemRequest(otherAccount.address));

      // Crank it
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);
      await pool.crank();

      // Redeem full amount
      const maxRedeem = await pool.maxRedeem(otherAccount.address);
      const txn = await pool
        .connect(otherAccount)
        .redeem(maxRedeem, otherAccount.address, otherAccount.address);
      expect(txn).to.changeTokenBalance(
        liquidityAsset,
        otherAccount.address,
        999
      );
      expect(await pool.totalSupply()).to.equal(0);
    });
  });

  describe("withdraw()", () => {
    it("burns shares and transfers assets", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolManager, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolManager).crank();

      const startingShares = await pool.balanceOf(otherAccount.address);
      const startingAssets = await liquidityAsset.balanceOf(
        otherAccount.address
      );
      expect(await pool.maxWithdraw(otherAccount.address)).to.equal(10);

      await pool
        .connect(otherAccount)
        .withdraw(10, otherAccount.address, otherAccount.address);

      expect(await liquidityAsset.balanceOf(otherAccount.address)).to.equal(
        startingAssets.add(10)
      );
      expect(await pool.balanceOf(otherAccount.address)).to.equal(
        startingShares.sub(10)
      );
    });

    it("reverts if the number of shares is too large", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolManager, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolManager).crank();

      const max = await pool.maxWithdraw(otherAccount.address);

      await expect(
        pool
          .connect(otherAccount)
          .withdraw(max.add(1), otherAccount.address, otherAccount.address)
      ).to.be.revertedWith("Pool: InsufficientBalance");
    });

    it("reverts if receiver !== owner", async () => {
      const { pool, otherAccount, otherAccounts } = await loadFixture(
        loadPoolFixture
      );

      const alice = otherAccounts[0];

      await expect(
        pool
          .connect(otherAccount)
          .withdraw(10, otherAccount.address, alice.address)
      ).to.be.revertedWith("Pool: Withdrawal to unrelated address");
    });

    it("reverts receiver is not msg.sender", async () => {
      const { pool, otherAccount, otherAccounts } = await loadFixture(
        loadPoolFixture
      );

      const alice = otherAccounts[0];

      await expect(
        pool.connect(otherAccount).withdraw(10, alice.address, alice.address)
      ).to.be.revertedWith("Pool: Must transfer to msg.sender");
    });
  });

  describe("fixed fees", () => {
    it("claiming fees is only available to the pool admin", async () => {
      const { pool, poolManager, otherAccount } = await loadFixture(
        loadPoolFixtureWithFees
      );

      const tx = pool.connect(otherAccount).claimFixedFee();
      await expect(tx).to.be.revertedWith("Pool: caller is not manager");
    });

    it("cannot claim fees until they're due", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolManager, liquidityAsset);
      const tx = pool.connect(poolManager).claimFixedFee();
      await expect(tx).to.revertedWith("Pool: fixed fee not due");
    });

    it("can claim fees when they're due", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolManager, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 30 days
      await time.increase(30 * 96_400);

      // Claim Fees
      const tx = pool.connect(poolManager).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolManager, 100);

      // Trying again will fail
      const tx2 = pool.connect(poolManager).claimFixedFee();
      await expect(tx2).to.be.revertedWith("Pool: fixed fee not due");
    });

    it("can cumulatively claim fees when they're due", async () => {
      const { pool, poolManager, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolManager, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 60 days
      await time.increase(60 * 96_400);

      // Claim Fees
      const tx = pool.connect(poolManager).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolManager, 100);

      const tx2 = pool.connect(poolManager).claimFixedFee();
      await expect(tx2).to.changeTokenBalance(liquidityAsset, poolManager, 100);
    });
  });
});
