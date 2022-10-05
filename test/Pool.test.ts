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
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { pool, liquidityAsset, serviceConfiguration } = await deployPool(
      poolManager
    );

    const { loan } = await deployLoan(
      pool.address,
      otherAccount.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return { pool, liquidityAsset, poolManager, otherAccount, loan };
  }

  describe("Deployment", () => {
    it("initializes the lifecycle on construction", async () => {
      const { pool } = await loadFixture(loadPoolFixture);

      expect(await pool.lifeCycleState()).to.equal(0); // Enums are treated as uint8
    });

    it("sets the pool manager", async () => {
      const { pool, poolManager } = await loadFixture(loadPoolFixture);

      expect(await pool.manager()).to.equal(poolManager.address);
    });

    it("sets the pool settings", async () => {
      const { pool } = await loadFixture(loadPoolFixture);

      const {
        endDate,
        maxCapacity,
        withdrawalFee,
        withdrawRequestPeriodDuration
      } = await pool.settings();

      expect(endDate).to.equal(DEFAULT_POOL_SETTINGS.endDate);
      expect(maxCapacity).to.equal(DEFAULT_POOL_SETTINGS.maxCapacity);
      expect(withdrawalFee).to.equal(DEFAULT_POOL_SETTINGS.withdrawalFee);
      expect(withdrawRequestPeriodDuration).to.equal(
        DEFAULT_POOL_SETTINGS.withdrawRequestPeriodDuration
      );
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
      const { pool, poolManager, otherAccount } = await loadFixture(
        loadPoolFixture
      );
      await expect(
        pool.connect(poolManager).defaultLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan is not in a valid state", async () => {
      const { pool, poolManager, liquidityAsset, loan } = await loadFixture(
        loadPoolFixture
      );
      await activatePool(pool, poolManager, liquidityAsset);
      await expect(
        pool.connect(poolManager).defaultLoan(loan.address)
      ).to.be.revertedWith("Loan: FunctionInvalidAtThisILoanLifeCycleState");
    });

    it("defaults loan if conditions are met", async () => {
      const { pool, poolManager, liquidityAsset, loan, otherAccount } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolManager, liquidityAsset);

      await collateralizeLoan(loan, otherAccount);
      await fundLoan(loan, pool, poolManager);

      const activeLoanPrincipalBefore = (await pool.accountings()).activeLoanPrincipals;
      const loanPrincipal = await loan.principal();

      await expect(pool.connect(poolManager).defaultLoan(loan.address)).to.emit(
        pool,
        "LoanDefaulted"
      );

      const activeLoanPrincipalsAfter = (await pool.accountings()).activeLoanPrincipals;
      expect(activeLoanPrincipalsAfter).is.equal(activeLoanPrincipalBefore.sub(loanPrincipal));
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
    describe("requestPeriod(), withdrawPeriod()", () => {
      it("returns the first period when the pool is not yet initialized", async () => {
        const { pool } = await loadFixture(loadPoolFixture);

        expect(await pool.requestPeriod()).to.equal(1);
        expect(await pool.withdrawPeriod()).to.equal(0);
      });

      it("returns the first period when the pool is activated", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolManager, liquidityAsset);

        expect(await pool.requestPeriod()).to.equal(1);
        expect(await pool.withdrawPeriod()).to.equal(0);
      });

      it("returns the second period when the first period has ended", async () => {
        const { pool, poolManager, liquidityAsset } = await loadFixture(
          loadPoolFixture
        );
        await activatePool(pool, poolManager, liquidityAsset);

        const { withdrawRequestPeriodDuration } = await pool.settings();
        await time.increase(withdrawRequestPeriodDuration);

        expect(await pool.requestPeriod()).to.equal(2);
        expect(await pool.withdrawPeriod()).to.equal(1);
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

      it("emits a WithdrawRequested event if the lender requests a valid amount", async () => {
        const { pool, poolManager, liquidityAsset, otherAccount } =
          await loadFixture(loadPoolFixture);
        await activatePool(pool, poolManager, liquidityAsset);

        await depositToPool(pool, otherAccount, liquidityAsset, 100);

        expect(await pool.connect(otherAccount).requestWithdraw(100))
          .to.emit(pool.address, "WithdrawRequested")
          .withArgs(otherAccount.address, 100);
      });
    });
  });
});
