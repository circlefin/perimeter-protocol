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
import { ethers } from "hardhat";
import {
  deployPool,
  activatePool,
  DEFAULT_POOL_SETTINGS
} from "../../support/pool";
import {
  DEFAULT_LOAN_SETTINGS,
  deployLoan,
  fundLoan
} from "../../support/loan";
import { deployMockERC20 } from "../../support/erc20";

describe("Open Term Matured Loan Scenario", () => {
  const INPUTS = {
    lenderDeposit: 1_000_000,
    loanAmount: 1_000_000,
    loanPayment: 4167
  };

  async function loadFixtures() {
    const [poolAdmin, lender, borrower] = await ethers.getSigners();

    const endTime = (await time.latest()) + 5_184_000; // 60 days.
    const poolSettings = {
      ...DEFAULT_POOL_SETTINGS,
      endDate: endTime
    };
    const { mockERC20 } = await deployMockERC20();
    const { pool, serviceConfiguration, poolController } = await deployPool({
      poolAdmin: poolAdmin,
      settings: poolSettings,
      liquidityAsset: mockERC20
    });

    // activate pool
    await activatePool(pool, poolAdmin, mockERC20);

    // Mint for lenders
    await mockERC20.mint(lender.address, INPUTS.lenderDeposit);

    // Lender allowance for pool
    await mockERC20.connect(lender).approve(pool.address, INPUTS.lenderDeposit);

    // Create loan
    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      mockERC20.address,
      serviceConfiguration,
      {
        loanType: 1 // open term
      }
    );

    // mint USDC for borrower to pay down loan
    await mockERC20.mint(
      borrower.address,
      (INPUTS.loanPayment * DEFAULT_LOAN_SETTINGS.duration) /
        DEFAULT_LOAN_SETTINGS.paymentPeriod
    );

    return {
      pool,
      poolController,
      lender,
      mockERC20,
      poolAdmin,
      borrower,
      loan
    };
  }

  it("Calculates outstanding loan principal", async () => {
    const {
      pool,
      poolController,
      lender,
      mockERC20,
      poolAdmin,
      borrower,
      loan
    } = await loadFixture(loadFixtures);

    await pool.connect(lender).deposit(INPUTS.lenderDeposit, lender.address);

    // fund loan and drawdown 1/2 of principal
    await fundLoan(loan, poolController, poolAdmin);

    // check pool accounting is correct
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      1_000_000
    );
    expect(await pool.liquidityPoolAssets()).to.equal(0);

    // drawdown half
    await loan.connect(borrower).drawdown(500_000);

    // pool admin reclaims the remaining 500k, check that accountings were updated
    await poolController
      .connect(poolAdmin)
      .reclaimLoanFunds(loan.address, 500_000);
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      500_000
    );

    // Payback a portion of the principal
    await mockERC20
      .connect(borrower)
      .approve(
        loan.address,
        INPUTS.loanAmount +
          (INPUTS.loanPayment * DEFAULT_LOAN_SETTINGS.duration) /
            DEFAULT_LOAN_SETTINGS.paymentPeriod
      );
    await loan.connect(borrower).paydownPrincipal(500_000);
    // check accountings again
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      500_000
    );

    // Complete payment
    await loan.connect(borrower).completeFullPayment();

    // check accountings again -- there's still 500k in the vault waiting for the
    // PA to claim.
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      500_000
    );
    expect(await mockERC20.balanceOf(loan.fundingVault())).to.equal(500_000);
    await poolController
      .connect(poolAdmin)
      .reclaimLoanFunds(loan.address, 500_000);
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(0);
  });
});
