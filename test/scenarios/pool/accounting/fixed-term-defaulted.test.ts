import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployPool,
  activatePool,
  DEFAULT_POOL_SETTINGS
} from "../../../support/pool";
import {
  collateralizeLoan,
  DEFAULT_LOAN_SETTINGS,
  deployLoan,
  fundLoan
} from "../../../support/loan";
import { deployMockERC20 } from "../../../support/erc20";

describe("Closed Term Matured Loan Scenario", () => {
  const INPUTS = {
    lenderDeposit: 1_000_000,
    loanAmount: 1_000_000,
    loanPayment: 4167
  };

  async function loadFixtures() {
    const [operator, poolAdmin, lender, borrower] = await ethers.getSigners();

    const poolSettings = {
      ...DEFAULT_POOL_SETTINGS,
      endDate: (await time.latest()) + 5_184_000
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
        loanType: 0 // fixed term
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

    // fund loan and drawdown
    await collateralizeLoan(loan, borrower, mockERC20, 0);
    await fundLoan(loan, pool, poolAdmin);

    // default loan
    await pool.connect(poolAdmin).defaultLoan(loan.address);

    // check that accountings go back to zero
    expect((await pool.accountings()).outstandingLoanPrincipals).to.equal(
      1_000_000
    );
  });
});
