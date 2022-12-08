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

describe("Open Term Defaulted Loan Scenario", () => {
  const INPUTS = {
    lenderDeposit: 1_000_000,
    loanAmount: 1_000_000,
    loanPayment: 4167
  };

  async function loadFixtures() {
    const [poolAdmin, lender, borrower] = await ethers.getSigners();

    const poolSettings = {
      ...DEFAULT_POOL_SETTINGS,
      endDate: (await time.latest()) + 5_184_000
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
        loanType: 1 // fixed term
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
    const { pool, poolController, lender, poolAdmin, borrower, loan } =
      await loadFixture(loadFixtures);

    await pool.connect(lender).deposit(INPUTS.lenderDeposit, lender.address);

    // fund loan and drawdown
    await fundLoan(loan, poolController, poolAdmin);
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      1_000_000
    );

    // default loan
    await loan.connect(borrower).drawdown((await loan.principal()).div(2)); // drawdown half
    await poolController.connect(poolAdmin).defaultLoan(loan.address);

    // check that outstanding principal goes down to 500k
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      500_000
    );

    // PA reclaims the rest
    await loan.connect(poolAdmin).reclaimFunds(500_000);
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(0);
  });
});
