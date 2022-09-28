import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployActivePool,
  deployPool,
  DEFAULT_POOL_SETTINGS
} from "./support/pool";

describe("Pool", () => {
  async function loadPoolFixture() {
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { pool, liquidityAsset } = await deployPool(poolManager);

    return { pool, liquidityAsset, poolManager, otherAccount };
  }

  async function loadActivePoolFixture() {
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { pool, liquidityAsset } = await deployActivePool(poolManager);

    return { pool, liquidityAsset, poolManager, otherAccount };
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
        withdrawWindowDurationSeconds
      } = await pool.settings();

      expect(endDate).to.equal(DEFAULT_POOL_SETTINGS.endDate);
      expect(maxCapacity).to.equal(DEFAULT_POOL_SETTINGS.maxCapacity);
      expect(withdrawalFee).to.equal(DEFAULT_POOL_SETTINGS.withdrawalFee);
      expect(withdrawWindowDurationSeconds).to.equal(
        DEFAULT_POOL_SETTINGS.withdrawWindowDurationSeconds
      );
    });
  });

  describe("supplyFirstLoss", async () => {
    it("first loss can be supplied and transitions lifecycle state", async () => {
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
        await pool.connect(poolManager).supplyFirstLoss(firstLossAmount)
      ).to.emit(pool.address, "FirstLossSupplied");

      // Check balance
      expect(await pool.firstLoss()).to.equal(firstLossAmount);

      // Check lifecycle
      expect(await pool.lifeCycleState()).to.equal(1); // Enum values are treated as ints
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
      await pool.connect(poolManager).supplyFirstLoss(firstLossInitialMinimum);

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

  describe("Permissions", () => {
    describe("updatePoolCapacity", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).updatePoolCapacity(1)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("updatePoolEndDate", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).updatePoolEndDate(1)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("requestWithdrawal", () => {
      it("reverts if not called by lender", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).requestWithdrawal(1)
        ).to.be.revertedWith("Pool: caller is not a lender");
      });
    });

    describe("fundLoan", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).fundLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("markLoanAsInDefault", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).markLoanAsInDefault(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not manager");
      });
    });

    describe("supplyFirstLoss", () => {
      it("reverts if not called by Pool Manager", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(
          pool.connect(otherAccount).supplyFirstLoss(100)
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
    describe("currentWithdrawWindowIndex()", () => {
      it("returns 0 if the pool is not active", async () => {
        const { pool } = await loadFixture(loadPoolFixture);

        expect(await pool.currentWithdrawWindowIndex()).to.equal(0);
      });

      it("returns 0 if the pool has not reached it's first withdrawal window", async () => {
        const { pool } = await loadFixture(loadActivePoolFixture);

        expect(await pool.currentWithdrawWindowIndex()).to.equal(0);
      });

      it("returns 0 if the pool is one second before the first withdrawal window", async () => {
        const { pool } = await loadFixture(loadActivePoolFixture);

        const { withdrawWindowDurationSeconds } = await pool.settings();
        await time.increase(withdrawWindowDurationSeconds.toNumber() - 1);

        expect(await pool.currentWithdrawWindowIndex()).to.equal(0);
      });

      it("returns 1 if the pool reached it's first withdraw window", async () => {
        const { pool } = await loadFixture(loadActivePoolFixture);

        const { withdrawWindowDurationSeconds } = await pool.settings();
        await time.increase(withdrawWindowDurationSeconds.toNumber());

        expect(await pool.currentWithdrawWindowIndex()).to.equal(1);
      });

      it("returns 1 if the pool is past it's first withdraw window", async () => {
        const { pool } = await loadFixture(loadActivePoolFixture);

        const { withdrawWindowDurationSeconds } = await pool.settings();
        await time.increase(withdrawWindowDurationSeconds.toNumber() + 1);

        expect(await pool.currentWithdrawWindowIndex()).to.equal(1);
      });

      it("returns 2 if the pool reached it's second withdraw window", async () => {
        const { pool } = await loadFixture(loadActivePoolFixture);

        const { withdrawWindowDurationSeconds } = await pool.settings();
        await time.increase(withdrawWindowDurationSeconds.toNumber() * 2);

        expect(await pool.currentWithdrawWindowIndex()).to.equal(2);
      });
    });
  });
});
