import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  activatePool,
  DEFAULT_POOL_SETTINGS,
  deployPermissionedPool,
  depositToPool,
  progressWithdrawWindow
} from "../support/pool";
import { collateralizeLoan, deployLoan, fundLoan } from "../support/loan";
import { getCommonSigners } from "../support/utils";
import { performVeriteVerification } from "../support/verite";

describe("PermissionedPool", () => {
  async function loadPoolFixture() {
    const {
      operator,
      borrower,
      poolAdmin,
      otherAccount,
      aliceLender: thirdAccount,
      bobLender: allowedLender
    } = await getCommonSigners();
    const {
      pool,
      liquidityAsset,
      poolAccessControl,
      poolAdminAccessControl,
      tosAcceptanceRegistry,
      poolController,
      serviceConfiguration
    } = await deployPermissionedPool({
      poolAdmin: poolAdmin
    });

    // allow allowedLender
    await tosAcceptanceRegistry.connect(allowedLender).acceptTermsOfService();
    await poolAccessControl
      .connect(poolAdmin)
      .allowParticipant(allowedLender.address);

    const { loan: openTermLoan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration,
      { loanType: 1 }
    );

    return {
      operator,
      pool,
      poolController,
      poolAccessControl,
      poolAdminAccessControl,
      liquidityAsset,
      poolAdmin,
      otherAccount,
      thirdAccount,
      allowedLender,
      openTermLoan,
      borrower
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

  describe("snapshot()", () => {
    it("reverts if not allowed lender or admin", async () => {
      const { pool, otherAccount } = await loadFixture(loadPoolFixture);

      await expect(pool.connect(otherAccount).snapshot()).to.be.revertedWith(
        "Pool: not allowed"
      );
    });

    it("snapshots the pool if allowed lender", async () => {
      const { pool, poolAdmin, allowedLender, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      await expect(pool.connect(allowedLender).snapshot()).to.emit(
        pool,
        "PoolSnapshotted"
      );
    });

    it("snapshots the pool if PA via poolController", async () => {
      const {
        pool,
        poolAdmin,
        poolAdminAccessControl,
        poolController,
        liquidityAsset,
        operator
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      // expect the snapshot to require an up to date Verification
      await expect(
        poolController.connect(poolAdmin).snapshot()
      ).to.be.revertedWith("ADMIN_NOT_ALLOWED");

      // Perform Verite Verification
      await performVeriteVerification(
        poolAdminAccessControl,
        operator,
        poolAdmin
      );

      await expect(poolController.connect(poolAdmin).snapshot()).to.emit(
        pool,
        "PoolSnapshotted"
      );
    });
  });

  describe("reclaimLoanFunds()", () => {
    it("reverts if not allowed PA", async () => {
      const { poolAdmin, poolController, openTermLoan } = await loadFixture(
        loadPoolFixture
      );

      // Since the PA is already Verite-verified, advance until the credential expired
      // The expiry is currently set to 1000 seconds
      await time.increase(1000);
      await expect(
        poolController
          .connect(poolAdmin)
          .reclaimLoanFunds(openTermLoan.address, 0)
      ).to.be.rejectedWith("ADMIN_NOT_ALLOWED");
    });

    it("reclaims funds if allowed PA", async () => {
      const {
        pool,
        poolAdmin,
        allowedLender,
        liquidityAsset,
        poolController,
        openTermLoan
      } = await loadFixture(loadPoolFixture);

      // Set up a funded open-term loan
      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        allowedLender,
        liquidityAsset,
        await openTermLoan.principal()
      );
      await fundLoan(openTermLoan, poolController, poolAdmin);

      const reclaimAmount = 1;
      const fundingVault = await openTermLoan.fundingVault();
      const txn = await poolController
        .connect(poolAdmin)
        .reclaimLoanFunds(openTermLoan.address, reclaimAmount);
      await expect(txn).to.not.be.reverted;
      await expect(txn).to.changeTokenBalances(
        liquidityAsset,
        [fundingVault, pool.address],
        [-reclaimAmount, +reclaimAmount]
      );
    });
  });

  describe("claimLoanCollateral()", () => {
    it("reverts if not allowed PA", async () => {
      const {
        poolAdmin,
        poolAdminAccessControl,
        poolController,
        openTermLoan
      } = await loadFixture(loadPoolFixture);

      // Since the PA is already Verite-verified, advance until the credential expired
      // The expiry is currently set to 1000 seconds
      await time.increase(1000);
      expect(await poolAdminAccessControl.isAllowed(poolAdmin.address)).to.be
        .false;

      await expect(
        poolController
          .connect(poolAdmin)
          .claimLoanCollateral(openTermLoan.address, [], [])
      ).to.be.rejectedWith("ADMIN_NOT_ALLOWED");
    });

    it("can reclaim collateral", async () => {
      const {
        poolAdmin,
        borrower,
        allowedLender,
        liquidityAsset,
        pool,
        poolAdminAccessControl,
        poolController,
        openTermLoan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        allowedLender,
        liquidityAsset,
        await openTermLoan.principal()
      );

      // collateralize loan
      const collateralAmount = 10;
      await liquidityAsset.mint(borrower.address, collateralAmount);
      await collateralizeLoan(
        openTermLoan,
        borrower,
        liquidityAsset,
        collateralAmount
      );

      // Fund loan
      await fundLoan(openTermLoan, poolController, poolAdmin);

      // Drawdown to activate it
      await openTermLoan.connect(borrower).drawdown(1);

      // Default loan
      await poolController.connect(poolAdmin).defaultLoan(openTermLoan.address);

      // PA can now claim collateral via PoolController
      const txn = await poolController
        .connect(poolAdmin)
        .claimLoanCollateral(
          openTermLoan.address,
          [liquidityAsset.address],
          []
        );

      const collateralLocker = await openTermLoan.collateralVault();
      await expect(txn).to.changeTokenBalances(
        liquidityAsset,
        [collateralLocker, poolAdmin.address],
        [-collateralAmount, +collateralAmount]
      );
    });
  });
});
