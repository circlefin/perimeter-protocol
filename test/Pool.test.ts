import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Pool", () => {
  const POOL_SETTINGS = {
    maxCapacity: 10_000_000,
    endDate: 2524611601, // Jan 1, 2050
    withdrawalFee: 50, // bips,
    firstLossInitialMinimum: 100_000
  };

  async function deployLiquidityAssetFixture() {
    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC");

    await liquidityAsset.deployed();
    return {
      liquidityAsset
    };
  }

  async function loadPoolFixture() {
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { liquidityAsset } = await deployLiquidityAssetFixture();

    const PoolLib = await ethers.getContractFactory("PoolLib");
    const poolLib = await PoolLib.deploy();

    const Pool = await ethers.getContractFactory("Pool", {
      libraries: {
        PoolLib: poolLib.address
      }
    });

    const pool = await Pool.deploy(
      liquidityAsset.address,
      poolManager.address,
      POOL_SETTINGS,
      "Valyria PoolToken",
      "VPT"
    );
    await pool.deployed();

    await liquidityAsset.mint(
      poolManager.address,
      POOL_SETTINGS.firstLossInitialMinimum
    );

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

      const { endDate, maxCapacity, withdrawalFee } = await pool.settings();

      expect(endDate).to.equal(POOL_SETTINGS.endDate);
      expect(maxCapacity).to.equal(POOL_SETTINGS.maxCapacity);
      expect(withdrawalFee).to.equal(POOL_SETTINGS.withdrawalFee);
    });
  });

  describe("supplyFirstLoss", async () => {
    it("first loss can be supplied and transitions lifecycle state", async () => {
      const { pool, poolManager, liquidityAsset } = await loadFixture(
        loadPoolFixture
      );

      const firstLossAmount = POOL_SETTINGS.firstLossInitialMinimum;

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
});
