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
import { deployPool, activatePool } from "../../support/pool";
import { deployLoan, fundLoan } from "../../support/loan";
import { deployMockERC20 } from "../../support/erc20";

describe("Business Scenario 2", () => {
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
    const [poolAdmin, lenderA, lenderB, borrower] = await ethers.getSigners();
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
    const { pool, serviceConfiguration, withdrawController, poolController } =
      await deployPool({
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
      pool,
      poolController,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      borrower,
      loan,
      withdrawController
    };
  }

  it("runs simulation", async () => {
    const {
      startTime,
      pool,
      poolController,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      borrower,
      loan,
      withdrawController
    } = await loadFixture(fixtures);

    // Initialization checks
    // check that FL is zero
    expect(await poolController.firstLossBalance()).to.equal(0);
    // Check that PM has no USDC balance
    expect(await mockUSDC.balanceOf(poolAdmin.address)).to.equal(0);

    // +2 days, lenderA deposits
    await advanceToDay(startTime, 2);
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
    await fundLoan(loan, poolController, poolAdmin);
    await loan.connect(borrower).drawdown(INPUTS.loan.principal);

    // +7 days, lenderA requests 200k PT redemption
    await advanceToDay(startTime, 7);
    await pool.snapshot(); // snapshot runs, but is meaningless
    await pool.connect(lenderA).requestRedeem(200_000_000_000);
    // check balances
    expect(
      await withdrawController.eligibleBalanceOf(lenderA.address)
    ).to.equal(0);
    expect(
      await withdrawController.eligibleBalanceOf(lenderB.address)
    ).to.equal(0);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(0);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(0);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(0);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(0);

    // +8 days, lenderB requests 300k PT redemption
    await advanceToDay(startTime, 8);
    await pool.connect(lenderB).requestRedeem(300_000_000_000);

    // +11 days, first loan payment made
    await advanceToDay(startTime, 11);
    await mockUSDC.connect(borrower).approve(loan.address, INPUTS.loanPayment);
    await loan.connect(borrower).completeNextPayment();

    // +14 days, run the snapshot
    await advanceToDay(startTime, 14);
    await pool.snapshot();
    // check balances
    await pool.connect(lenderA).claimSnapshots(10);
    await pool.connect(lenderB).claimSnapshots(10);
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
    await pool.snapshot();
    // check balances
    await pool.connect(lenderA).claimSnapshots(10);
    await pool.connect(lenderB).claimSnapshots(10);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(195141980444);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(292712970667);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(200729166664);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(301093749997);

    // +22 days, lender A requests remaining PT redemption
    await advanceToDay(startTime, 22);
    await pool
      .connect(lenderA)
      .requestRedeem(await pool.maxRedeemRequest(lenderA.address));

    // +28 days, run the snapshot
    await advanceToDay(startTime, 28);
    await pool.snapshot();
    // check balances
    await pool.connect(lenderA).claimSnapshots(10);
    await pool.connect(lenderB).claimSnapshots(10);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(425828499681);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(298694213967);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(444944035134);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(307425756525);

    // +29 days, lender B requests remaining PT redemption
    await advanceToDay(startTime, 29);
    await pool
      .connect(lenderB)
      .requestRedeem(await pool.maxRedeemRequest(lenderB.address));

    // +35 days, run the snapshot
    await advanceToDay(startTime, 35);
    await pool.snapshot();
    // check balances
    await pool.connect(lenderA).claimSnapshots(10);
    await pool.connect(lenderB).claimSnapshots(10);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(451009487935);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(387442345077);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(472632381851);
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(405010847307);

    // + to close, snapshot, inspect results
    await time.increaseTo((await pool.settings()).endDate);
    await pool.snapshot();

    // check balances
    // Lender A and B can redeem the same # of shares, but their assets differ
    // as they requested to withdraw at different times.
    await pool.connect(lenderA).claimSnapshots(10);
    await pool.connect(lenderB).claimSnapshots(10);
    expect(await pool.maxRedeem(lenderA.address)).to.equal(476190476189);
    expect(await pool.maxRedeem(lenderB.address)).to.equal(476190476189);
    expect(await pool.maxWithdraw(lenderA.address)).to.equal(500320728568); // $500,320
    expect(await pool.maxWithdraw(lenderB.address)).to.equal(502595938091); // $502,595

    // Check that the pool only has dust
    expect(await pool.totalAvailableAssets()).to.be.lt(5);
    expect(await pool.totalAvailableSupply()).to.be.lt(5);

    // Sanity check that withdrawals can actually be done at advertised rate
    const txn1 = await pool
      .connect(lenderA)
      .withdraw(500320728568, lenderA.address, lenderA.address);
    expect(txn1).to.changeTokenBalance(pool, lenderA.address, -476190476189);
    expect(txn1).to.changeTokenBalance(
      mockUSDC,
      lenderA.address,
      +500320728568
    );

    const txn2 = await pool
      .connect(lenderB)
      .withdraw(502595938091, lenderB.address, lenderB.address);
    expect(txn2).to.changeTokenBalance(pool, lenderB.address, -476190476189);
    expect(txn2).to.changeTokenBalance(
      mockUSDC,
      lenderB.address,
      +502595938091
    );
  });
});
