/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  activatePool,
  deployPermissionedPool,
  depositToPool
} from "../support/pool";
import { collateralizeLoan, deployLoan, fundLoan } from "../support/loan";
import { getCommonSigners } from "../support/utils";
import { performVeriteVerification } from "../support/verite";

describe("PermissionedPoolController", () => {
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

  describe("cancelFundedLoan()", () => {
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
        poolController.connect(poolAdmin).cancelFundedLoan(openTermLoan.address)
      ).to.be.rejectedWith("ADMIN_NOT_ALLOWED");
    });

    it("can cancel loan if allowed PA", async () => {
      const {
        poolAdmin,
        allowedLender,
        liquidityAsset,
        pool,
        poolController,
        openTermLoan,
        poolAdminAccessControl,
        operator
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        allowedLender,
        liquidityAsset,
        await openTermLoan.principal()
      );

      // Fund loan
      await fundLoan(openTermLoan, poolController, poolAdmin);
      const dropDeadDate = await openTermLoan.dropDeadTimestamp();
      const now = await time.latest();
      if (now < dropDeadDate.toNumber()) {
        await time.increaseTo(dropDeadDate);
      }

      // Re-verify PA
      await performVeriteVerification(
        poolAdminAccessControl,
        operator,
        poolAdmin
      );

      // Cancel loan
      await poolController
        .connect(poolAdmin)
        .cancelFundedLoan(openTermLoan.address);
      expect(await openTermLoan.state()).to.equal(2); // canceled
    });
  });

  describe("markLoanCallback()", () => {
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
        poolController.connect(poolAdmin).markLoanCallback(openTermLoan.address)
      ).to.be.rejectedWith("ADMIN_NOT_ALLOWED");
    });

    it("can mark loan callback if allowed PA", async () => {
      const { poolAdmin, poolController, openTermLoan } = await loadFixture(
        loadPoolFixture
      );

      expect(await openTermLoan.callbackTimestamp()).to.equal(0);
      await expect(
        poolController.connect(poolAdmin).markLoanCallback(openTermLoan.address)
      ).to.not.be.reverted;
      expect(await openTermLoan.callbackTimestamp()).to.not.equal(0);
    });
  });
});
