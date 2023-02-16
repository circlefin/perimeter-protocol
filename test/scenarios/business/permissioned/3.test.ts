import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployPermissionedPool, activatePool } from "../../../support/pool";
import { deployLoan, fundLoan } from "../../../support/loan";
import { deployMockERC20 } from "../../../support/erc20";
import { performVeriteVerification } from "../../../support/verite";
import { getCommonSigners } from "../../../support/utils";

describe("Permissioned Business Scenario 3", () => {
  const INPUTS = {
    lenderADepositAmount: 500_000_000_000, // $500k in USDC
    lenderBDepositAmount: 500_000_000_000, // $500k in USDC
    pool: {
      maxCapacity: 20_000_000_000_000, // $20M in USDC
      requestFeeBps: 500, // 5%
      withdrawGateBps: 5_000, // 50%
      requestCancellationFeeBps: 0,
      firstLossInitialMinimum: 0,
      withdrawRequestPeriodDuration: 7 * 24 * 60 * 60, // 7 days
      fixedFee: 0,
      fixedFeeInterval: 0,
      serviceFeeBps: 2_000 // 20%
    },
    loan: {
      duration: 14,
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
    const { operator, poolAdmin, otherAccounts } = await getCommonSigners();
    const [lenderA, lenderB, borrower] = otherAccounts.slice(0, 3);
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
      poolAdminAccessControl,
      poolAccessControl,
      tosAcceptanceRegistry
    } = await deployPermissionedPool({
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

    return {
      startTime,
      operator,
      pool,
      poolController,
      poolAccessControl,
      poolAdminAccessControl,
      tosAcceptanceRegistry,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      borrower,
      loan
    };
  }

  it("runs simulation", async () => {
    const {
      startTime,
      operator,
      pool,
      poolController,
      poolAccessControl,
      poolAdminAccessControl,
      tosAcceptanceRegistry,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      borrower,
      loan
    } = await loadFixture(fixtures);

    // Initialization checks
    // check that FL is zero
    expect(await poolController.firstLossBalance()).to.equal(0);
    // Check that PM has no USDC balance
    expect(await mockUSDC.balanceOf(poolAdmin.address)).to.equal(0);

    // Update lenderA and lenderB to accept ToS
    await tosAcceptanceRegistry.connect(lenderA).acceptTermsOfService();
    await tosAcceptanceRegistry.connect(lenderB).acceptTermsOfService();

    // +2 days, lenderA deposits
    await advanceToDay(startTime, 2);
    await expect(
      pool
        .connect(lenderA)
        .deposit(INPUTS.lenderADepositAmount, lenderA.address)
    ).to.be.revertedWith("LENDER_NOT_ALLOWED");
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool
      .connect(lenderA)
      .deposit(INPUTS.lenderADepositAmount, lenderA.address);

    // sanity-check lenderA is cleared out
    expect(await mockUSDC.balanceOf(lenderA.address)).to.equal(0);
    // check pool tokens minted
    expect(await pool.balanceOf(lenderA.address)).to.equal(
      INPUTS.lenderADepositAmount
    );

    // +3 days, LenderB deposits
    await advanceToDay(startTime, 3);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool
      .connect(lenderB)
      .deposit(INPUTS.lenderBDepositAmount, lenderB.address);

    // sanity-check lenderB is cleared out
    expect(await mockUSDC.balanceOf(lenderB.address)).to.equal(0);
    // check pool tokens minted
    expect(await pool.balanceOf(lenderB.address)).to.equal(
      INPUTS.lenderBDepositAmount
    );

    // +4  days, loan is funded
    await advanceToDay(startTime, 4);
    await performVeriteVerification(
      poolAdminAccessControl,
      operator,
      poolAdmin
    );
    await fundLoan(loan, poolController, poolAdmin);
    await loan.connect(borrower).drawdown(INPUTS.loan.principal);

    // +7 days, lenderA requests 200k PT redemption
    await advanceToDay(startTime, 7);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool.connect(lenderA).snapshot(); // snapshot runs, but is meaningless
    await pool.connect(lenderA).requestRedeem(200_000_000_000);

    // +8 days, lenderB requests 300k PT redemption
    await advanceToDay(startTime, 8);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool.connect(lenderB).requestRedeem(300_000_000_000);

    // +11 days, first loan payment made
    await advanceToDay(startTime, 11);
    await mockUSDC.connect(borrower).approve(loan.address, INPUTS.loanPayment);
    await loan.connect(borrower).completeNextPayment();

    // +14 days, run the snapshot
    await advanceToDay(startTime, 14);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool.connect(lenderB).snapshot();
    await pool.connect(lenderA).claimSnapshots(1);
    await pool.connect(lenderB).claimSnapshots(1);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(283960890);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(425941335);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(291666665);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(437499998);

    // +18 days, complete payment made
    await advanceToDay(startTime, 18);
    await mockUSDC
      .connect(borrower)
      .approve(loan.address, INPUTS.loanPayment + INPUTS.loan.principal);
    await loan.connect(borrower).completeFullPayment();

    // +21 days, run the snapshot
    await advanceToDay(startTime, 21);
    // check balances before
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);

    // Unchanged from before
    expect(await pool.maxRedeem(lenderA.address)).to.equal(283960890);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(425941335);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(291666665);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(437499998);

    await pool.connect(lenderB).snapshot();
    await pool.connect(lenderA).claimSnapshots(1);
    await pool.connect(lenderB).claimSnapshots(1);

    // check balances after
    expect(await pool.maxRedeem(lenderA.address)).to.equal(195141980444);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(292712970667);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(200729166664);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(301093749997);

    // +22 days, lender A requests remaining PT redemption
    await advanceToDay(startTime, 22);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool
      .connect(lenderA)
      .requestRedeem(await pool.maxRedeemRequest(lenderA.address));

    // +23 days, lender A redeems 190k Pool tokens
    await advanceToDay(startTime, 23);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await pool
      .connect(lenderA)
      .redeem(190_000_000_000, lenderA.address, lenderA.address);

    // +28 days, run the snapshot
    await advanceToDay(startTime, 28);
    // check balances before
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(5141980444);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(292712970667);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(5289202494);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(301093749997);

    await pool.connect(lenderA).snapshot();
    await pool.connect(lenderA).claimSnapshots(1);
    await pool.connect(lenderB).claimSnapshots(1);

    // check balances after
    expect(await pool.maxRedeem(lenderA.address)).to.equal(235828499681);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(298694213967);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(249504070964);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(307425756525);

    // +29 days, lender B requests remaining PT redemption
    await advanceToDay(startTime, 29);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool
      .connect(lenderB)
      .requestRedeem(await pool.maxRedeemRequest(lenderB.address));

    // +30 days, lender B redeems 295k in pool tokens
    await advanceToDay(startTime, 30);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    await pool
      .connect(lenderB)
      .redeem(295_000_000_000, lenderB.address, lenderB.address);

    // +35 days, run the snapshot
    await advanceToDay(startTime, 35);
    // check balances before
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(235828499681);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(3694213967);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(249504070964);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(3802204631);

    await pool.connect(lenderB).snapshot();
    await pool.connect(lenderA).claimSnapshots(1);
    await pool.connect(lenderB).claimSnapshots(1);

    // check balances after
    expect(await pool.maxRedeem(lenderA.address)).to.equal(261009487935);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(92442345077);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(277192417681);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(101387295413);

    // +39 days, inspect results
    await advanceToDay(startTime, 39);

    // check balances
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderA);
    await performVeriteVerification(poolAccessControl, poolAdmin, lenderB);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(261009487935);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(92442345077);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(277192417681);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(101387295413);

    expect(await mockUSDC.balanceOf(lenderA.address)).to.equal(195439964170);
    expect(await mockUSDC.balanceOf(lenderB.address)).to.equal(303623551894);

    // Sanity check that withdrawals can actually be done at advertised rate
    const txn1 = await pool
      .connect(lenderA)
      .withdraw(277192417681, lenderA.address, lenderA.address);
    expect(txn1).to.changeTokenBalance(pool, lenderA.address, -261009487935);
    expect(txn1).to.changeTokenBalance(
      mockUSDC,
      lenderA.address,
      +277192417681
    );

    const txn2 = await pool
      .connect(lenderB)
      .withdraw(101387295413, lenderB.address, lenderB.address);
    expect(txn2).to.changeTokenBalance(pool, lenderB.address, -92442345077);
    expect(txn2).to.changeTokenBalance(
      mockUSDC,
      lenderB.address,
      +101387295413
    );
  });
});
