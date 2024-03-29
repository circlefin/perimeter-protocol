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
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Withdraw Requests", () => {
  async function loadPoolFixture() {
    const [poolAdmin, aliceLender, bobLender] = await ethers.getSigners();
    const { pool, liquidityAsset, poolController, withdrawController } =
      await deployPool({
        poolAdmin: poolAdmin
      });

    // Set the request fee to 10%
    await poolController.connect(poolAdmin).setRequestFee(1000);

    // Set the withdraw gate to 25%
    await poolController.connect(poolAdmin).setWithdrawGate(2500);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 100 tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, 100);

    // deposit 70 tokens from Bob
    await depositToPool(pool, bobLender, liquidityAsset, 70);

    return {
      pool,
      poolController,
      liquidityAsset,
      withdrawController,
      poolAdmin,
      aliceLender,
      bobLender
    };
  }

  async function loadPoolFixtureNoFees() {
    const [poolAdmin, aliceLender, bobLender] = await ethers.getSigners();
    const { pool, liquidityAsset, poolController, withdrawController } =
      await deployPool({
        poolAdmin: poolAdmin,
        settings: {
          requestCancellationFeeBps: 0,
          requestFeeBps: 0,
          withdrawGateBps: 0
        }
      });

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 100 tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, 100);

    // deposit 100 tokens from Bob
    await depositToPool(pool, bobLender, liquidityAsset, 100);

    return {
      pool,
      poolController,
      liquidityAsset,
      withdrawController,
      poolAdmin,
      aliceLender,
      bobLender
    };
  }

  it("allows requesting of a withdraw", async () => {
    const { pool, aliceLender, bobLender, withdrawController } =
      await loadFixture(loadPoolFixture);
    const { withdrawRequestPeriodDuration } = await pool.settings();

    // Expect Alice to be able to request her full balance, minus fees
    expect(await pool.maxRedeemRequest(aliceLender.address)).to.equal(90);
    expect(await pool.maxWithdrawRequest(aliceLender.address)).to.equal(90);

    // Expect Bob to be able to request his full balance, minus fees
    expect(await pool.maxRedeemRequest(bobLender.address)).to.equal(63);
    expect(await pool.maxWithdrawRequest(bobLender.address)).to.equal(63);

    // Request a withdraw from Alice for Period n + 1 (in this case, 1)
    await expect(pool.connect(aliceLender).requestWithdraw(50))
      .to.emit(pool, "WithdrawRequested")
      .withArgs(aliceLender.address, 50, 50);

    await expect(pool.connect(bobLender).requestRedeem(10))
      .to.emit(pool, "WithdrawRequested")
      .withArgs(bobLender.address, 10, 10);

    // Ensure a fee was paid (10% of 60 = 6 tokens)
    expect(await pool.totalSupply()).to.equal(164);
    expect(await pool.totalAssets()).to.equal(170); // unchanged
    expect(await pool.balanceOf(aliceLender.address)).to.equal(95);
    expect(await pool.balanceOf(bobLender.address)).to.equal(69);

    // Verify Alice's withdrawal state is updated
    expect(
      await withdrawController.requestedBalanceOf(aliceLender.address)
    ).to.equal(50);
    expect(
      await withdrawController.eligibleBalanceOf(aliceLender.address)
    ).to.equal(0);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(0);
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(0);

    // Verify Bob's withdrawal state is updated
    expect(
      await withdrawController.requestedBalanceOf(bobLender.address)
    ).to.equal(10);
    expect(
      await withdrawController.eligibleBalanceOf(bobLender.address)
    ).to.equal(0);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(0);
    expect(await pool.maxWithdraw(bobLender.address)).to.equal(0);

    // Verify the Global withdrawal state is updated
    expect(await withdrawController.totalRequestedBalance()).to.equal(60);
    expect(await withdrawController.totalEligibleBalance()).to.equal(0);
    expect(await withdrawController.totalRedeemableShares()).to.equal(0);
    expect(await withdrawController.totalWithdrawableAssets()).to.equal(0);

    // Expect Alice's maxWithdrawRequest amounts have decreased
    expect(await pool.maxRedeemRequest(aliceLender.address)).to.equal(
      Math.floor(
        (100 /* initial balance */ -
          50 /* requested */ -
          5) /* previous request fee */ *
          0.9 /* sub the request fee */
      )
    );
    expect(await pool.maxWithdrawRequest(aliceLender.address)).to.equal(41);

    // Expect Bob's maxWithdrawRequest amounts have decreased
    expect(await pool.maxRedeemRequest(bobLender.address)).to.equal(
      Math.floor(
        (70 /* initial balance */ -
          10 /* requested */ -
          1) /* previous request fee */ *
          0.9 /* sub the request fee */
      )
    );
    expect(await pool.maxWithdrawRequest(bobLender.address)).to.equal(54);

    // Skip ahead to the next window
    await time.increase(withdrawRequestPeriodDuration);

    // expect the request and withdraw periods to have advanced
    expect(await withdrawController.withdrawPeriod()).to.equal(1);

    // nothing changes until we snapshot
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(0);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(0);

    // snapshot it
    await pool.snapshot();
    await pool.connect(aliceLender).claimSnapshots(1);
    await pool.connect(bobLender).claimSnapshots(1);

    // 170 assets = 160 shares. 25% withdraw gate = 40
    expect(await withdrawController.totalRedeemableShares()).to.equal(40);
    expect(await withdrawController.totalWithdrawableAssets()).to.equal(41);

    // verify the global state is updated
    expect(await withdrawController.totalRequestedBalance()).to.equal(0);
    expect(await withdrawController.totalEligibleBalance()).to.equal(
      20
    ); /* 60 - 40 */

    // verify Alice's state is updated
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      33
    ); /* 50 * (40/60) = 33.33 rounded down */
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(33);

    // verify Bob's state is updated
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      6
    ); /* 10 * (41/60) */
    expect(await pool.maxWithdraw(bobLender.address)).to.equal(6);

    // Cancel a request
    expect(await pool.maxRequestCancellation(aliceLender.address)).to.equal(17);
    expect(await pool.maxRequestCancellation(bobLender.address)).to.equal(4);

    // Cancel Bob's request
    const bobBalance = await pool.balanceOf(bobLender.address);
    await pool.connect(bobLender).cancelRedeemRequest(3);

    // Expect a fee to be paid
    expect(await pool.balanceOf(bobLender.address)).to.equal(bobBalance.sub(1));
    expect(await pool.maxRequestCancellation(bobLender.address)).to.equal(1);
  });

  it("allows canceling a full request balance", async () => {
    const { pool, aliceLender, withdrawController } = await loadFixture(
      loadPoolFixture
    );

    // Alice requests full redemption
    await pool
      .connect(aliceLender)
      .requestRedeem(await pool.maxRedeemRequest(aliceLender.address));
    expect(
      await withdrawController.requestedBalanceOf(aliceLender.address)
    ).to.equal(90);

    // Check max request cancellation
    expect(await pool.maxRequestCancellation(aliceLender.address)).to.equal(90);

    // Cancel request
    const txn = await pool.connect(aliceLender).cancelRedeemRequest(90);

    // Check that the cancellation burned a PT in fees
    // 1% cancellation fee of 90 == 1 token
    await expect(txn).to.changeTokenBalance(pool, aliceLender.address, -1);

    // Check requested balance is now zeroed out
    expect(
      await withdrawController.requestedBalanceOf(aliceLender.address)
    ).to.equal(0);
  });

  it("cancellations affect the global withdraw state consistently with the individuals", async () => {
    const { pool, aliceLender, bobLender, withdrawController } =
      await loadFixture(loadPoolFixtureNoFees);
    const { withdrawRequestPeriodDuration } = await pool.settings();

    expect(await pool.maxRedeemRequest(aliceLender.address)).to.equal(100);
    expect(await pool.maxRedeemRequest(bobLender.address)).to.equal(100);

    // Request half
    await pool.connect(aliceLender).requestRedeem(50);
    await pool.connect(bobLender).requestRedeem(50);

    // Advance to next period
    await time.increase(withdrawRequestPeriodDuration);

    // Request other half
    await pool.connect(aliceLender).claimSnapshots(1);
    await pool.connect(bobLender).claimSnapshots(1);
    await pool.connect(aliceLender).requestRedeem(50);
    await pool.connect(bobLender).requestRedeem(50);

    // We now expect each lender to have 50 requested and 50 eligible
    expect(
      await withdrawController.eligibleBalanceOf(aliceLender.address)
    ).to.equal(50);
    expect(
      await withdrawController.requestedBalanceOf(aliceLender.address)
    ).to.equal(50);

    expect(
      await withdrawController.eligibleBalanceOf(bobLender.address)
    ).to.equal(50);
    expect(
      await withdrawController.requestedBalanceOf(bobLender.address)
    ).to.equal(50);

    // We expect the global requested balance and the global eligible balance to be 100 and 100
    expect(await withdrawController.totalRequestedBalance()).to.equal(100);
    expect(await withdrawController.totalEligibleBalance()).to.equal(100);

    // Alice now cancels the 100 shares (her full balance)
    await pool.connect(aliceLender).claimSnapshots(10);
    await pool.connect(aliceLender).cancelRedeemRequest(100);

    // We expect her requested balance to be 0 and her eligible balance to be 0
    expect(
      await withdrawController.requestedBalanceOf(aliceLender.address)
    ).to.equal(0);
    expect(
      await withdrawController.eligibleBalanceOf(aliceLender.address)
    ).to.equal(0);

    // Since Alice had 50 eligible and 50 requested, we should expect those same amounts
    // to be decremented from the global withdraw state.
    // So we expect the global state to now have 50 requested and 50 eligible
    expect(await withdrawController.totalRequestedBalance()).to.equal(50);
    expect(await withdrawController.totalEligibleBalance()).to.equal(50);
  });
});
