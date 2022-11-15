import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployPool,
  DEFAULT_POOL_SETTINGS,
  depositToPool,
  activatePool
} from "./support/pool";
import {
  deployLoan,
  collateralizeLoan,
  fundLoan,
  DEFAULT_LOAN_SETTINGS
} from "./support/loan";

describe("Pool", () => {
  async function loadPoolFixture() {
    const [operator, poolAdmin, borrower, otherAccount, ...otherAccounts] =
      await ethers.getSigners();

    const { pool, liquidityAsset, serviceConfiguration, poolController } =
      await deployPool({
        operator,
        poolAdmin: poolAdmin
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
      poolController,
      collateralAsset,
      liquidityAsset,
      poolAdmin,
      borrower,
      otherAccount,
      loan,
      otherAccounts
    };
  }

  async function loadPoolFixtureWithFees() {
    const [operator, poolAdmin, otherAccount] = await ethers.getSigners();
    const settings = Object.assign({}, DEFAULT_POOL_SETTINGS);
    settings.fixedFee = 100;
    settings.fixedFeeInterval = 30;
    const { pool, liquidityAsset, serviceConfiguration } = await deployPool({
      operator,
      poolAdmin: poolAdmin,
      settings
    });

    const { loan } = await deployLoan(
      pool.address,
      otherAccount.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return { pool, liquidityAsset, poolAdmin, otherAccount, loan };
  }

  async function loanPoolFixtureWithMaturedLoan() {
    const { pool, otherAccount, borrower, liquidityAsset, poolAdmin, loan } =
      await loadFixture(loadPoolFixture);

    await activatePool(pool, poolAdmin, liquidityAsset);

    await liquidityAsset.connect(otherAccount).approve(pool.address, 1_000_000);

    await depositToPool(pool, otherAccount, liquidityAsset, 1_000_000);
    await collateralizeLoan(loan, borrower, liquidityAsset);
    await fundLoan(loan, pool, poolAdmin);
    await loan.connect(borrower).drawdown(await loan.principal());

    await liquidityAsset.connect(borrower).approve(loan.address, 2_000_000);
    await liquidityAsset.approve(loan.address, 2_000_000);
    await liquidityAsset.mint(borrower.address, 200_000);
    await loan.connect(borrower).completeFullPayment();

    return { pool, otherAccount, loan, borrower, liquidityAsset };
  }

  describe("deposit()", async () => {
    it("deposit cannot be called if pool is initialized", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      expect(await pool.state()).to.equal(0); // initialized

      await expect(
        pool.connect(otherAccount).deposit(100, otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("depositing mints shares to receiver", async () => {
      const { pool, otherAccount, liquidityAsset, poolAdmin } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

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

      expect(await pool.state()).to.equal(0); // initialized

      await expect(
        pool.connect(otherAccount).mint(100, otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("minting mints shares to receiver", async () => {
      const { pool, otherAccount, liquidityAsset, poolAdmin } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

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
      const { pool, poolAdmin, loan } = await loadFixture(loadPoolFixture);
      await expect(
        pool.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan if Pool hasn't funded loan yet", async () => {
      const { pool, poolAdmin, liquidityAsset, loan } = await loadFixture(
        loadPoolFixture
      );
      await activatePool(pool, poolAdmin, liquidityAsset);
      await expect(
        pool.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: unfunded loan");
    });

    it("defaults loan if loan is active, and pool is active", async () => {
      const {
        collateralAsset,
        pool,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Collateralize loan
      await collateralizeLoan(loan, borrower, collateralAsset);

      // Deposit to pool and fund loan
      const loanPrincipal = await loan.principal();
      await depositToPool(pool, otherAccount, liquidityAsset, loanPrincipal);
      await fundLoan(loan, pool, poolAdmin);
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
      await expect(pool.connect(poolAdmin).defaultLoan(loan.address))
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
      await fundLoan(loan, pool, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward to pool end date
      await time.increaseTo((await pool.settings()).endDate);
      expect(await pool.state()).to.equal(3); // Closed

      // Default should proceed
      await expect(pool.connect(poolAdmin).defaultLoan(loan.address)).not.to.be
        .reverted;
    });
  });

  describe("fundLoan()", () => {
    it("reverts if pool is not active", async () => {
      const { pool, otherAccount, poolAdmin } = await loadFixture(
        loadPoolFixture
      );

      expect(await pool.state()).to.equal(0); // initialized

      await expect(
        pool.connect(poolAdmin).fundLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan address is not recognized", async () => {
      const { pool, liquidityAsset, otherAccount, poolAdmin } =
        await loadFixture(loadPoolFixture);

      expect(await pool.state()).to.equal(0); // initialized
      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(pool.connect(poolAdmin).fundLoan(otherAccount.address)).to.be
        .reverted;
    });

    it("funds the loan from pool liquidity", async () => {
      const { pool, liquidityAsset, otherAccount, borrower, poolAdmin, loan } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);

      const txn = await pool.connect(poolAdmin).fundLoan(loan.address);

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

    it("reverts if loan amount exceeds totalAvailableAssets in the pool", async () => {
      const { pool, liquidityAsset, otherAccount, borrower, poolAdmin, loan } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal
      );

      // Now request withdraw
      const redeemAmount = await pool.maxRedeemRequest(otherAccount.address);
      await pool.connect(otherAccount).requestRedeem(redeemAmount);

      // fast forward and crank
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);
      await pool.crank();

      // double check that the funds are now available for withdraw
      expect(await pool.maxRedeem(otherAccount.address)).to.equal(redeemAmount);

      // check that totalAvailableAssets is dust
      expect(await pool.totalAvailableAssets()).to.lessThan(10);
      await expect(
        pool.connect(poolAdmin).fundLoan(loan.address)
      ).to.be.revertedWith("Pool: not enough assets");
    });
  });

  describe("previewDeposit()", async () => {
    it("includes interest when calculating deposit exchange rate", async () => {
      const lender = (await ethers.getSigners())[10];
      const {
        collateralAsset,
        pool,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
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
      await fundLoan(loan, pool, poolAdmin);
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

  describe("Permissions", () => {
    describe("fundLoan()", () => {
      it("reverts if not called by Pool Admin", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).fundLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not admin");
      });
    });

    describe("defaultLoan()", () => {
      it("reverts if not called by Pool Admin", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).defaultLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not admin");
      });
    });
  });

  describe("transfer()", async () => {
    it("transfers are disabled", async () => {
      const { pool, poolAdmin, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      pool.mint(10, poolAdmin.address);
      await expect(
        pool.connect(poolAdmin).transfer(otherAccount.address, 10)
      ).to.be.revertedWith("Pool: transfers disabled");
    });

    it("transfer to zero address is denied", async () => {
      const { pool, poolAdmin } = await loadFixture(loadPoolFixture);

      pool.mint(10, poolAdmin.address);
      await expect(
        pool.connect(poolAdmin).transfer(ethers.constants.AddressZero, 10)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("transferFrom()", async () => {
    it("transfers are disabled", async () => {
      const { pool, poolAdmin, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      pool.mint(10, poolAdmin.address);
      pool.connect(poolAdmin).approve(otherAccount.address, 10);
      await expect(
        pool
          .connect(otherAccount)
          .transferFrom(poolAdmin.address, otherAccount.address, 10)
      ).to.be.revertedWith("Pool: transfers disabled");
    });

    it("transfer to zero address is denied", async () => {
      const { pool, poolAdmin, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      pool.mint(10, poolAdmin.address);
      pool.connect(poolAdmin).approve(otherAccount.address, 10);
      await expect(
        pool
          .connect(otherAccount)
          .transferFrom(poolAdmin.address, ethers.constants.AddressZero, 10)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });

  describe("Withdrawal Requests", () => {
    describe("maxRedeemRequest()", () => {
      it("returns the current number of shares minus fees if no requests have been made", async () => {
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(
          await pool
            .connect(otherAccount)
            .maxRedeemRequest(otherAccount.address)
        ).to.equal(95);
      });

      it("returns the current number of shares minus existing requests and fees if any", async () => {
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestRedeem(51);

        expect(
          await pool
            .connect(otherAccount)
            .maxRedeemRequest(otherAccount.address)
        ).to.equal(43);
      });

      it("returns 0 if the requested balance is > what is available", async () => {
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
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
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestRedeem(51);

        expect(await pool.maxRedeemRequest(otherAccount.address)).to.equal(43);
      });
    });

    describe("previewRedeemRequest", () => {
      it("returns the number of assets, minus fees, rounded down, that would be transferred in this redeem request, regardless of caller balance", async () => {
        const { pool, poolController, poolAdmin, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await poolController.connect(poolAdmin).setRequestFee(1000); // 10%
        await activatePool(pool, poolAdmin, liquidityAsset);

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
        const { pool, poolAdmin, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolAdmin, liquidityAsset);

        await expect(pool.requestRedeem(100)).to.be.revertedWith(
          "Pool: caller is not a lender"
        );
      });

      it("reverts if the lender is requesting to redeem more than their balance", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        const balance = await pool.balanceOf(otherAccount.address);

        await expect(
          pool.connect(otherAccount).requestWithdraw(balance.add(1))
        ).to.be.revertedWith("Pool: InsufficientBalance");
      });

      it("performs a redeem request, paying the fee", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(100);

        // TODO: Show a non 1:1 share value
        await pool.connect(otherAccount).requestRedeem(50);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(97);
      });

      it("emits a RedeemRequested event if the lender requests a valid amount", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        const max = await pool.maxRedeemRequest(otherAccount.address);

        expect(await pool.connect(otherAccount).requestRedeem(max))
          .to.emit(pool.address, "RedeemRequested")
          .withArgs(otherAccount.address, max);
      });
    });

    describe("maxWithdrawRequest(address)", () => {
      it("returns the current number of assets minus fees if no requests have been made", async () => {
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(
          await pool
            .connect(otherAccount)
            .maxWithdrawRequest(otherAccount.address)
        ).to.equal(95);
      });

      it("returns the current number of assets minus existing requests and fees if any", async () => {
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestWithdraw(51);

        expect(
          await pool
            .connect(otherAccount)
            .maxWithdrawRequest(otherAccount.address)
        ).to.equal(44);
      });

      it("returns 0 if the requested balance is > what is available", async () => {
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
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
        const { pool, poolAdmin, otherAccount, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await pool.connect(otherAccount).requestWithdraw(51);

        expect(await pool.maxWithdrawRequest(otherAccount.address)).to.equal(
          44
        );
      });
    });

    describe("previewWithdrawRequest(assets)", () => {
      it("returns the share value of the provided assets, minus fees, regardless of caller balance", async () => {
        const { pool, poolController, poolAdmin, liquidityAsset } =
          await loadFixture(loadPoolFixture);
        await poolController.connect(poolAdmin).setRequestFee(1000); // 10%
        await activatePool(pool, poolAdmin, liquidityAsset);

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
        const { pool, poolAdmin, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolAdmin, liquidityAsset);

        await expect(pool.requestWithdraw(100)).to.be.revertedWith(
          "Pool: caller is not a lender"
        );
      });

      it("reverts if the lender is requesting to withdraw more than their balance", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        await expect(
          pool.connect(otherAccount).requestWithdraw(101)
        ).to.be.revertedWith("Pool: InsufficientBalance");
      });

      it("performs a withdraw request, paying the fee", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(100);

        // TODO: Show a non 1:1 share value
        await pool.connect(otherAccount).requestWithdraw(50);

        expect(await pool.balanceOf(otherAccount.address)).to.equal(97);
      });

      it("emits a WithdrawRequested event if the lender requests a valid amount", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        const max = await pool.maxWithdrawRequest(otherAccount.address);

        expect(await pool.connect(otherAccount).requestWithdraw(max))
          .to.emit(pool.address, "WithdrawRequested")
          .withArgs(otherAccount.address, max);
      });
    });

    describe("maxRedeem()", () => {
      it("returns the redeemable number of shares for a given lender", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(10);

        await time.increase(withdrawRequestPeriodDuration);
        await pool.connect(poolAdmin).crank();

        expect(await pool.maxRedeem(otherAccount.address)).to.equal(10);
      });
    });

    describe("maxWithdraw()", () => {
      it("returns the withdrawable number of shares for a given lender", async () => {
        const { pool, poolAdmin, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        const { withdrawRequestPeriodDuration } = await pool.settings();
        await activatePool(pool, poolAdmin, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);
        await pool.connect(otherAccount).requestRedeem(10);

        await time.increase(withdrawRequestPeriodDuration);
        await pool.connect(poolAdmin).crank();

        expect(await pool.maxWithdraw(otherAccount.address)).to.equal(10);
      });
    });
  });

  describe("previewRedeem()", () => {
    it("returns the number of assets that will be returned if the requested shares were available on the current block", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      expect(await pool.connect(otherAccount).previewRedeem(100)).to.equal(100);
    });
  });

  describe("redeem()", () => {
    it("burns shares and transfers assets", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolAdmin).crank();

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
      const { pool, poolAdmin, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolAdmin).crank();

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
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
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
      const { pool, poolAdmin, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolAdmin).crank();

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
      const { pool, poolAdmin, liquidityAsset, otherAccount, otherAccounts } =
        await loadFixture(loadPoolFixture);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await activatePool(pool, poolAdmin, liquidityAsset);
      const bob = otherAccounts[0];

      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await pool.connect(otherAccount).requestRedeem(10);
      await depositToPool(pool, bob, liquidityAsset, 100);
      await pool.connect(bob).requestRedeem(30);

      await time.increase(withdrawRequestPeriodDuration);
      await pool.connect(poolAdmin).crank();

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
      const { pool, poolAdmin, otherAccount } = await loadFixture(
        loadPoolFixtureWithFees
      );

      const tx = pool.connect(otherAccount).claimFixedFee();
      await expect(tx).to.be.revertedWith("Pool: caller is not admin");
    });

    it("cannot claim fees until they're due", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);
      const tx = pool.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.revertedWith("Pool: fixed fee not due");
    });

    it("can claim fees when they're due", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 30 days
      await time.increase(30 * 96_400);

      // Claim Fees
      const tx = pool.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);

      // Trying again will fail
      const tx2 = pool.connect(poolAdmin).claimFixedFee();
      await expect(tx2).to.be.revertedWith("Pool: fixed fee not due");
    });

    it("can cumulatively claim fees when they're due", async () => {
      const { pool, poolAdmin, liquidityAsset, otherAccount } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 60 days
      await time.increase(60 * 96_400);

      // Claim Fees
      const tx = pool.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);

      const tx2 = pool.connect(poolAdmin).claimFixedFee();
      await expect(tx2).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);
    });
  });
});
