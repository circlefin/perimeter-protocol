import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Pool", () => {

  const POOL_SETTINGS = {
    maxCapacity: 10_000_000,
    endDate: 2524611601, // Jan 1, 2050
    withdrawalFee: 50 // bips
  }

  async function deployLiquidityAssetFixture() {
    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy(
      "Test Coin",
      "TC"
    )

    await liquidityAsset.deployed();
    return {
      liquidityAsset
    };
  }

  async function loadPoolFixture() {
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { liquidityAsset } = await deployLiquidityAssetFixture();

    const Pool = await ethers.getContractFactory("Pool");
    const pool = await Pool.deploy(
      liquidityAsset.address,
      poolManager.address,
      POOL_SETTINGS,
      "Valyria PoolToken",
      "VPT"
    );
    await pool.deployed();
    return { pool, liquidityAsset, poolManager, otherAccount};
  }

  describe("Deployment", () => {
    it("initializes the lifecycle on construction", async () => {
      const { pool } = await loadFixture(
        loadPoolFixture
      );
  
      expect(
        await pool.lifeCycleState()
      ).to.equal(0); // Enums are treated as uint8
    });
  
    it("sets the pool manager", async () => {  
      const { pool, poolManager } = await loadFixture(
        loadPoolFixture
      );
  
      expect(
        await pool.manager()
      ).to.equal(poolManager.address);
    });
  
    it("sets the pool settings", async () => {
      const { pool } = await loadFixture(
        loadPoolFixture
      );
  
      const { endDate, maxCapacity, withdrawalFee } = await pool.settings();
      
      expect(endDate).to.equal(POOL_SETTINGS.endDate);
      expect(maxCapacity).to.equal(POOL_SETTINGS.maxCapacity);
      expect(withdrawalFee).to.equal(POOL_SETTINGS.withdrawalFee);
    });
  });

  describe("Permissions", () => {
    describe("updatePoolCapacity", () => {
      it("reverts if not called by PM", async () => {
        const { pool, otherAccount } = await loadFixture(
          loadPoolFixture
        );
          
        await expect(
          pool.connect(otherAccount).updatePoolCapacity(1)
        ).to.be.revertedWith("Pool: caller is not PM");
      });
    });

    describe("updatePoolEndDate", () => {
      it("reverts if not called by PM", async () => {
        const { pool, otherAccount } = await loadFixture(
          loadPoolFixture
        );
          
        await expect(
          pool.connect(otherAccount).updatePoolEndDate(1)
        ).to.be.revertedWith("Pool: caller is not PM");
      });
    });

    describe("requestWithdrawal", () => {
      it("reverts if not called by lender", async () => {
        const { pool, otherAccount } = await loadFixture(
          loadPoolFixture
        );
          
        await expect(
          pool.connect(otherAccount).requestWithdrawal(1)
        ).to.be.revertedWith("Pool: caller is not a lender");
      });
    });

    describe("fundLoan", () => {
      it("reverts if not called by PM", async () => {
        const { pool, otherAccount } = await loadFixture(
          loadPoolFixture
        );
          
        await expect(
          pool.connect(otherAccount).fundLoan(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not PM");
      });
    });

    describe("markLoanAsInDefault", () => {
      it("reverts if not called by PM", async () => {
        const { pool, otherAccount } = await loadFixture(
          loadPoolFixture
        );
          
        await expect(
          pool.connect(otherAccount).markLoanAsInDefault(otherAccount.address)
        ).to.be.revertedWith("Pool: caller is not PM");
      });
    });
  });
 
});
