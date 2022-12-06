import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPermissionedPool, activatePool } from "../../../support/pool";
import { collateralizeLoan, deployLoan, fundLoan } from "../../../support/loan";
import { deployMockERC20 } from "../../../support/erc20";
import { performVeriteVerification } from "../../../support/verite";

describe("Permissioned Business Scenario 4", () => {
  const INPUTS = {
    lenderADepositAmount: 500_000_000_000, // $500k in USDC
    lenderBDepositAmount: 500_000_000_000, // $500k in USDC
    pool: {
      maxCapacity: 20_000_000_000_000, // $20M in USDC
      requestFeeBps: 500, // 5%
      withdrawGateBps: 5_000, // 50%
      requestCancellationFeeBps: 0,
      firstLossInitialMinimum: 100_000_000_000, // $100k
      withdrawRequestPeriodDuration: 7 * 24 * 60 * 60, // 7 days
      fixedFee: 0,
      fixedFeeInterval: 0,
      poolFeePercentOfInterest: 2_000 // 20%
    },
    loan: {
      duration: 28,
      paymentPeriod: 7,
      loanType: 0,
      apr: 1000,
      principal: 1_000_000_000_000,
      dropDeadDateDuration: 0,
      latePaymentFee: 0,
      latePayment: 0,
      originationBps: 0
    },
    loanPayment: 3888_890_000 // each loan payment, + rounding
  };

  async function advanceToDay(startTime: number, numberDays: number) {
    await time.increaseTo(startTime + numberDays * 3600 * 24);
  }

  async function fixtures() {
    const [operator, poolAdmin, lenderA, lenderB, borrower] =
      await ethers.getSigners();
    const endTime = (await time.latest()) + 5_184_000; // 60 days.
    const poolSettings = {
      endDate: endTime, // Jan 1, 2050
      ...INPUTS.pool
    };
    const { mockERC20: mockUSDC } = await deployMockERC20(
      "Mock USDC",
      "MUSDC",
      6
    );
    const {
      pool,
      serviceConfiguration,
      poolController,
      poolAccessControl,
      tosAcceptanceRegistry
    } = await deployPermissionedPool({
      operator,
      poolAdmin: poolAdmin,
      settings: poolSettings,
      liquidityAsset: mockUSDC
    });

    // Confirm FL fee is set to 5%
    expect(await serviceConfiguration.firstLossFeeBps()).to.equal(500);

    // activate pool
    await activatePool(pool, poolAdmin, mockUSDC);
    const startTime = (await pool.activatedAt()).toNumber();

    // Mint for lenders
    await mockUSDC.mint(lenderA.address, INPUTS.lenderADepositAmount);
    await mockUSDC.mint(lenderB.address, INPUTS.lenderBDepositAmount);

    // Lender allowance for pool
    await mockUSDC
      .connect(lenderA)
      .approve(pool.address, INPUTS.lenderADepositAmount);
    await mockUSDC
      .connect(lenderB)
      .approve(pool.address, INPUTS.lenderBDepositAmount);

    // Create loanOne
    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      mockUSDC.address,
      serviceConfiguration,
      INPUTS.loan
    );
    // mint USDC for borrower to pay down loanOne
    await mockUSDC.mint(borrower.address, INPUTS.loanPayment);

    // Collateralize loan
    await collateralizeLoan(loan, borrower, mockUSDC);

    return {
      startTime,
      pool,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      poolController,
      poolAccessControl,
      tosAcceptanceRegistry,
      borrower,
      loan
    };
  }

  it("runs simulation", async () => {
    const {
      startTime,
      pool,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      poolController,
      poolAccessControl,
      tosAcceptanceRegistry,
      borrower,
      loan
    } = await loadFixture(fixtures);

    // Initialization checks
    // check that FL is zero
    expect(await poolController.firstLossBalance()).to.equal(
      INPUTS.pool.firstLossInitialMinimum
    );
    // Check that PM has no USDC balance
    expect(await mockUSDC.balanceOf(poolAdmin.address)).to.equal(0);

    // Update lenderA and lenderB to accept ToS
    await tosAcceptanceRegistry.connect(lenderA).acceptTermsOfService();
    await tosAcceptanceRegistry.connect(lenderB).acceptTermsOfService();

    // +2 days, lenderA deposits
    await advanceToDay(startTime, 2);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool
      .connect(lenderA)
      .deposit(INPUTS.lenderADepositAmount, lenderA.address);

    // +3 days, LenderB deposits
    await advanceToDay(startTime, 3);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool
      .connect(lenderB)
      .deposit(INPUTS.lenderBDepositAmount, lenderB.address);

    // +4  days, loan is funded
    await advanceToDay(startTime, 4);
    await fundLoan(loan, poolController, poolAdmin);
    await loan.connect(borrower).drawdown(INPUTS.loan.principal);

    // +7 days, lenderA requests 200k PT redemption
    await advanceToDay(startTime, 7);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool.connect(lenderA).crank(); // crank runs, but is meaningless
    await pool.connect(lenderA).requestRedeem(200_000_000_000);

    // +8 days, lenderB requests 300k PT redemption
    await advanceToDay(startTime, 8);
    await expect(
      pool.connect(lenderB).requestRedeem(300_000_000_000)
    ).to.be.revertedWith("LENDER_NOT_ALLOWED");
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool.connect(lenderB).requestRedeem(300_000_000_000);

    // +11 days, first loan payment made
    await advanceToDay(startTime, 11);
    await mockUSDC.connect(borrower).approve(loan.address, INPUTS.loanPayment);
    await loan.connect(borrower).completeNextPayment();

    // +14 days, run the crank
    await advanceToDay(startTime, 14);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool.connect(lenderB).crank();

    // check balances
    expect(await pool.maxRedeem(lenderA.address)).to.equal(283960890);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(425941335);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(291666666);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(437499999);

    // +18 days, complete payment made
    await advanceToDay(startTime, 18);
    await mockUSDC.connect(borrower).approve(loan.address, INPUTS.loanPayment);
    await loan.connect(borrower).completeNextPayment();

    // +21 days, run the crank
    await advanceToDay(startTime, 21);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool.connect(lenderA).crank();

    // Check balances
    expect(await pool.maxRedeem(lenderA.address)).to.equal(709282417);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(1063923626);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(729166666);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(1093749999);

    // +22 days, lender A requests remaining PT redemption
    await advanceToDay(startTime, 22);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool
      .connect(lenderA)
      .requestRedeem(await pool.maxRedeemRequest(lenderA.address));

    // +24 days, PA marks loan in default
    await advanceToDay(startTime, 24);
    await poolController.connect(poolAdmin).defaultLoan(loan.address);
    expect(await pool.liquidityPoolAssets()).to.equal(101288194446);

    // +28 days, run the crank
    await advanceToDay(startTime, 28);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool.connect(lenderB).crank();

    // check balances
    expect(await pool.maxRedeem(lenderA.address)).to.equal(295243564205);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(186238276910);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(31823922339);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(20643091547);

    // +29 days, lender B requests remaining PT redemption
    await advanceToDay(startTime, 29);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool
      .connect(lenderB)
      .requestRedeem(await pool.maxRedeemRequest(lenderB.address));

    // +35 days, run the crank
    await advanceToDay(startTime, 35);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool.connect(lenderA).crank();

    // +39 days, inspect results
    await advanceToDay(startTime, 39);

    // check balances
    expect(await pool.maxRedeem(lenderA.address)).to.equal(385717020197);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(331214376549);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(41554130767);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(36234931729);
  });
});
