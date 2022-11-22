import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployPool,
  activatePool,
  DEFAULT_POOL_SETTINGS
} from "../../../support/pool";
import {
  DEFAULT_LOAN_SETTINGS,
  deployLoan,
  fundLoan
} from "../../../support/loan";
import { deployMockERC20 } from "../../../support/erc20";

describe("Open Term Matured Loan Scenario", () => {
  const INPUTS = {
    lenderDeposit: 1_000_000,
    loanAmount: 1_000_000,
    loanPayment: 4167
  };

  async function loadFixtures() {
    const [operator, poolAdmin, lender, borrower] = await ethers.getSigners();

    const endTime = (await time.latest()) + 5_184_000; // 60 days.
    const poolSettings = {
      ...DEFAULT_POOL_SETTINGS,
      endDate: endTime
    };
    const { mockERC20 } = await deployMockERC20();
    const { pool, serviceConfiguration } = await deployPool({
      operator,
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
      lender,
      mockERC20,
      poolAdmin,
      borrower,
      loan
    };
  }

  it("Calculates outstanding loan principal", async () => {
    const { pool, lender, mockERC20, poolAdmin, borrower, loan } =
      await loadFixture(loadFixtures);

    await pool.connect(lender).deposit(INPUTS.lenderDeposit, lender.address);

    // fund loan and drawdown 1/2 of principal
    await fundLoan(loan, pool, poolAdmin);

    // check pool accounting is correct
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      1_000_000
    );
    expect(await pool.liquidityPoolAssets()).to.equal(0);

    // drawdown half
    await loan.connect(borrower).drawdown(500_000);

    // pool admin reclaims the remaining 500k, check that accountings were updated
    await loan.connect(poolAdmin).reclaimFunds(500_000);
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
    await loan.connect(poolAdmin).reclaimFunds(500_000);
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(0);
  });
});
