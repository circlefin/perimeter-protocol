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
import { deployLoan, fundLoan } from "../../support/loan";
import { deployPool, depositToPool, activatePool } from "../../support/pool";
import { getCommonSigners } from "../../support/utils";

describe("Snapshot Variations", () => {
  const DEPOSIT_AMOUNT = 1_000_000;

  async function loadPoolFixture() {
    const { poolAdmin, aliceLender, bobLender, borrower } =
      await getCommonSigners();

    const {
      pool,
      liquidityAsset,
      withdrawController,
      poolController,
      serviceConfiguration
    } = await deployPool({
      poolAdmin: poolAdmin
    });

    // Set the request fee to 0, for simplicity
    await poolController.connect(poolAdmin).setRequestFee(0);

    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    const { withdrawRequestPeriodDuration } = await pool.settings();

    return {
      pool,
      loan,
      borrower,
      liquidityAsset,
      poolAdmin,
      aliceLender,
      bobLender,
      withdrawRequestPeriodDuration,
      withdrawController,
      poolController
    };
  }

  it("calculates correctly from a request before the first snapshot", async () => {
    const {
      pool,
      aliceLender,
      poolAdmin,
      withdrawRequestPeriodDuration,
      withdrawController,
      liquidityAsset,
      poolController
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 25%
    await poolController.connect(poolAdmin).setWithdrawGate(5000);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward 1st period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.snapshot();
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    ); // 500k

    // Fast forward to 2nd period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.snapshot();
    expect(await withdrawController.withdrawPeriod()).to.equal(2);
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      (3 * DEPOSIT_AMOUNT) / 4
    ); // 500k + (remainder = 500k) / 2 = 750k

    // Fast forward to 3rd period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.snapshot();
    expect(await withdrawController.withdrawPeriod()).to.equal(3);
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(875_000); // 750k + (remainder = 250k) / 2 = 875k

    // Fast forward to 4th period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.snapshot();
    expect(await withdrawController.withdrawPeriod()).to.equal(4);
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(937_500); // 875k + (remainder = 125k) / 2 = 875k

    // Fast forward to pool close date
    const { endDate } = await pool.settings();
    await time.increaseTo(endDate);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);
  });

  it("calculates correctly when 2nd lender requests midway", async () => {
    const {
      pool,
      aliceLender,
      bobLender,
      liquidityAsset,
      poolAdmin,
      withdrawRequestPeriodDuration,
      withdrawController,
      poolController
    } = await loadFixture(loadPoolFixture);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // deposit 1M tokens from Bob as well
    await depositToPool(pool, bobLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Set the withdraw gate to 50%
    await poolController.connect(poolAdmin).setWithdrawGate(5000);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward to 1st period. Pool is snapshotted, earmarking a full 1M for Alice.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    await pool.snapshot(); // 1M should be earmarked
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);

    // Fast forward to 2nd period. Pool is snapshotted, and then Bob requests their full amount.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(2);
    await pool.snapshot();
    await pool.connect(bobLender).requestRedeem(DEPOSIT_AMOUNT);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(0);

    // Fast forward to 3rd period. Pool is snapshotted,
    await time.increase(withdrawRequestPeriodDuration);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(0);
    await pool.snapshot(); // Bob should now be able to withdraw 1M / 2 = 500k
    expect(await withdrawController.withdrawPeriod()).to.equal(3);
    await pool.connect(bobLender).claimSnapshots(1);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    );

    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);

    // Fast forward to 4th period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    await pool.connect(bobLender).claimSnapshots(1);
    expect(await withdrawController.withdrawPeriod()).to.equal(4);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      (3 * DEPOSIT_AMOUNT) / 4
    );
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);

    // Fast forward to pool close date
    const { endDate } = await pool.settings();
    await time.increaseTo(endDate);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    await pool.connect(bobLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(DEPOSIT_AMOUNT);

    // check that they can actually withdraw
    await pool
      .connect(aliceLender)
      .redeem(DEPOSIT_AMOUNT, aliceLender.address, aliceLender.address);
    await pool
      .connect(bobLender)
      .redeem(DEPOSIT_AMOUNT, bobLender.address, bobLender.address);
    expect(await liquidityAsset.balanceOf(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT
    );
    expect(await liquidityAsset.balanceOf(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT
    );
  });

  it("does not over allocate a given user after multiple snapshots", async () => {
    const {
      pool,
      aliceLender,
      bobLender,
      liquidityAsset,
      poolAdmin,
      withdrawRequestPeriodDuration,
      withdrawController,
      poolController
    } = await loadFixture(loadPoolFixture);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Set the withdraw gate to 50%
    await poolController.connect(poolAdmin).setWithdrawGate(5000);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward to 1st period. Pool is snapshotted, earmarking a full 1M for Alice.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    await pool.snapshot(); // 1M should be earmarked
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    );

    // Fast forward to 2nd period. Pool is snapshotted, and then Bob requests their full amount.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(2);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      (DEPOSIT_AMOUNT * 3) / 4
    );

    // Now deposit enough from Bob to fulfill the request
    await depositToPool(pool, bobLender, liquidityAsset, DEPOSIT_AMOUNT);
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(3);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);

    // Ensure that subsequent snapshots dont over allocate
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(4);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);

    // Once again, with a request from Bob mixed in
    await pool.connect(bobLender).requestRedeem(DEPOSIT_AMOUNT);
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(5);
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);

    // sanity check bob too; they should receive 1/2, since they requested before the last snapshot, which earmarked 50% of 1M - dust
    await pool.connect(bobLender).claimSnapshots(1);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    );
  });

  it("on pool close, you can withdraw sooner", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 50%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(5000);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // close the pool
    const newCloseDate = (await time.latest()) + 2; // Skip ahead so that it's not in the past by the time of the next call.
    await poolController.connect(poolAdmin).setPoolEndDate(newCloseDate);
    await time.increaseTo(newCloseDate + 1);

    // Check that the pool is closed
    expect(await pool.state()).to.equal(2);

    // Check that we're still in the same withdraw period, since it has only been a few seconds.
    expect(await withdrawController.withdrawPeriod()).to.equal(0);

    // Fast forward 1 day...previously the window was 30 days
    await time.increase(86400);

    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(2);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);
  });

  it("can accumulate across a multitude of snapshots", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to .5%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(50);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Accumulate many snapshots.
    for (let i = 0; i < 100; i++) {
      await pool.snapshot();
      await time.increase(withdrawRequestPeriodDuration);
    }

    await pool.connect(aliceLender).claimSnapshots(200);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(394_186);
  });

  it("can claim 1 snapshot", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 50%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(2500);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Accumulate many snapshots.
    for (let i = 0; i < 5; i++) {
      await pool.snapshot();
      await time.increase(withdrawRequestPeriodDuration);
    }

    // Claim a single snapshot
    // .25 * 1M = 250k
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(250_000);
    expect(await pool.claimRequired(aliceLender.address)).is.true;
  });

  it("can claim 2 snapshots", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 50%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(2500);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Accumulate many snapshots.
    for (let i = 0; i < 5; i++) {
      await pool.snapshot();
      await time.increase(withdrawRequestPeriodDuration);
    }

    // Claim 2 snapshots
    // .25 * 1M = 250k
    // 750_000 * .25 = 187500
    await pool.connect(aliceLender).claimSnapshots(2);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      250_000 + 187500
    );
    expect(await pool.claimRequired(aliceLender.address)).is.true;
  });

  it("can claim snapshots successively", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 50%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(2500);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Accumulate many snapshots.
    for (let i = 0; i < 5; i++) {
      await pool.snapshot();
      await time.increase(withdrawRequestPeriodDuration);
    }

    // Claim 1 snapshot
    // .25 * 1M = 250k
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(250_000);
    expect(await pool.claimRequired(aliceLender.address)).is.true;

    // Claim 1 snapshot again
    // 750_000 * .25 = 187500
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      250_000 + 187500
    );
    expect(await pool.claimRequired(aliceLender.address)).is.true;
  });

  it("can gradually claim all snapshots", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 50%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(2500);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Accumulate many snapshots.
    for (let i = 0; i < 5; i++) {
      await time.increase(withdrawRequestPeriodDuration);
      await pool.snapshot();
    }

    // Claim 1 snapshot
    // .25 * 1M = 250k
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(250_000);
    expect(await pool.claimRequired(aliceLender.address)).is.true;

    // Claim 2 snapshots
    // 750_000 * .25 = 187500
    // 562500 * .25 = 140625
    await pool.connect(aliceLender).claimSnapshots(2);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      250_000 + 187_500 + 140_625
    );
    expect(await pool.claimRequired(aliceLender.address)).is.true;

    // Claim 1 more
    // 421875 * 0.25 = 105468.75
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      250_000 + 187_500 + 140_625 + 105467
    );
    expect(await pool.claimRequired(aliceLender.address)).is.true;

    // Claim 1 more
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      250_000 + 187_500 + 140_625 + 105_468 + 79_100
    );
    // Check that we're all caught up
    expect(await pool.claimRequired(aliceLender.address)).is.false;
  });

  it("can claim all snapshots all at once", async () => {
    const {
      pool,
      aliceLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 50%, and fees to 0 to simplify numbers.
    await poolController.connect(poolAdmin).setWithdrawGate(2500);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);
    // Accumulate many snapshots.
    for (let i = 0; i < 5; i++) {
      await time.increase(withdrawRequestPeriodDuration);
      await pool.snapshot();
    }

    // Claim all at once
    await pool.connect(aliceLender).claimSnapshots(10); // more than needed
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      250_000 + 187_500 + 140_625 + 105_468 + 79_100
    );
    expect(await pool.claimRequired(aliceLender.address)).is.false;
  });

  it("funds earmarked by snapshots do not accumulate interest", async () => {
    const {
      pool,
      loan,
      borrower,
      aliceLender,
      bobLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    await poolController.connect(poolAdmin).setWithdrawGate(10_000);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice and Bob
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);
    await depositToPool(pool, bobLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Advance to window 1
    await time.increase(withdrawRequestPeriodDuration);

    // Fund loan
    await fundLoan(loan, poolController, poolAdmin);
    await liquidityAsset.mint(borrower.address, 1_000_000); // mint extra to pay back interest
    await liquidityAsset.connect(borrower).approve(loan.address, 2_000_000);
    await loan.connect(borrower).drawdown(await loan.principal());

    // Payback loan
    await loan.connect(borrower).completeFullPayment();

    // Advance again
    await time.increase(withdrawRequestPeriodDuration);

    // Claim all at once
    await pool.connect(aliceLender).claimSnapshots(3);
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT // 1:1, even though interest was paid back to the pool, making shares more valuable
    );
  });

  it("eligible balances should not accumulate interest as active loans are repaid with no other pool activity", async () => {
    const {
      pool,
      loan,
      borrower,
      aliceLender,
      bobLender,
      liquidityAsset,
      poolAdmin,
      withdrawController,
      poolController,
      withdrawRequestPeriodDuration
    } = await loadFixture(loadPoolFixture);

    await poolController.connect(poolAdmin).setWithdrawGate(10_000);
    await poolController.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice and Bob
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);
    await depositToPool(pool, bobLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fund loan immediately in window 0
    await fundLoan(loan, poolController, poolAdmin);
    await liquidityAsset.mint(borrower.address, 1_000_000); // mint extra to pay back interest
    await liquidityAsset.connect(borrower).approve(loan.address, 2_000_000);
    await loan.connect(borrower).drawdown(await loan.principal());

    // Make payback loan in window 1
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    await loan.connect(borrower).completeFullPayment();

    // Claim
    // Since the lender requested a full redeem, and there's 100% liquidity gate,
    // the full requested amount should be serviced at whenever the next snapshot is.
    // We expect that the interest accrued in the intervening time should not accrue to the lender.
    await pool.connect(aliceLender).claimSnapshots(1);
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT // 1:1, even though interest was paid back to the pool, making shares more valuable
    );
  });
});
