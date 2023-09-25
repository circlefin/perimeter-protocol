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
import { deployMockERC20 } from "../../support/erc20";
import { deployPool, depositToPool, activatePool } from "../../support/pool";
import { getCommonSigners } from "../../support/utils";

describe("Withdrawal Dos", () => {
  async function loadPoolFixture() {
    const { poolAdmin, otherAccounts } = await getCommonSigners();

    const { mockERC20 } = await deployMockERC20("MockToken", "MT", 6);

    const attacker = otherAccounts[0];
    const lenderOne = otherAccounts[1];
    const lenderTwo = otherAccounts[2];

    const scale = 10 ** 6;
    const month = 30 * 24 * 60 * 60;
    const year = 12 * month;

    const poolSettings = {
      maxCapacity: 1_000_000 * scale,
      endDate: (await time.latest()) + year, // Jan 1, 2050
      requestFeeBps: 0,
      requestCancellationFeeBps: 0,
      withdrawGateBps: 2_500, // bps (25%)
      firstLossInitialMinimum: 10_000 * scale,
      withdrawRequestPeriodDuration: month,
      fixedFee: 0,
      fixedFeeInterval: month,
      serviceFeeBps: 0 // bps (0%)
    };

    const { pool, withdrawController, poolController } = await deployPool({
      poolAdmin: poolAdmin,
      settings: poolSettings,
      liquidityAsset: mockERC20
    });

    // Mint to all the lenders
    await mockERC20.mint(attacker.address, 100_000_000 * scale);
    await mockERC20.mint(lenderOne.address, 100_000_000 * scale);
    await mockERC20.mint(lenderTwo.address, 100_000_000 * scale);

    // Activate pool
    await activatePool(pool, poolAdmin, mockERC20);

    return {
      pool,
      withdrawController,
      poolController,
      mockERC20,
      poolAdmin,
      attacker,
      lenderOne,
      lenderTwo,
      scale,
      month
    };
  }

  it("runs scenario", async () => {
    const { pool, mockERC20, attacker, lenderOne, lenderTwo, scale, month } =
      await loadFixture(loadPoolFixture);

    // Deposit from attacker
    const attackAmount = 20_010 * scale;
    await mockERC20.connect(attacker).approve(pool.address, attackAmount);
    await depositToPool(pool, attacker, mockERC20, attackAmount);

    // Deposit from lenderOne
    const depositAmount = 40_000 * scale;
    await mockERC20.connect(lenderOne).approve(pool.address, depositAmount);
    await depositToPool(pool, lenderOne, mockERC20, depositAmount);

    // Deposit from lenderTwo
    await mockERC20.connect(lenderTwo).approve(pool.address, depositAmount);
    await depositToPool(pool, lenderTwo, mockERC20, depositAmount);

    // Request redeem from attacker
    await pool.connect(attacker).requestRedeem(10_000 * scale);
    await time.increase(month);
    await pool.snapshot();

    // 25% of 100,010 = 25002.5 * scale should be be available
    // to service withdrawals. However, only 10_000 should allocated to service the request.
    // 90,010 should be free-floating in the pool
    await pool.connect(attacker).claimSnapshots(1);
    expect(await pool.maxWithdraw(attacker.address)).to.equal(10_000 * scale);
    expect(await pool.liquidityPoolAssets()).to.equal(90_010 * scale);

    // Request redeem again from attacker
    await pool.connect(attacker).requestRedeem(10_000 * scale);
    await time.increase(month);
    await pool.snapshot();

    // 25% of 90010 = 22502.5 * scale should be be available
    // to service withdrawals. However, only 10_000 should allocated to service the request.
    await pool.connect(attacker).claimSnapshots(1);
    expect(await pool.maxWithdraw(attacker.address)).to.equal(20_000 * scale);

    // expect 80,010 to be free-loating in the pool
    expect(await pool.liquidityPoolAssets()).to.equal(80_010 * scale);

    // Request redeem yet again from attacker
    // 25% of 80,010 = 20002.5 should be available to service the request
    await pool.connect(attacker).requestRedeem(10 * scale - 2);
    await time.increase(month);
    await pool.snapshot();
    await pool.connect(attacker).claimSnapshots(1);

    // check remainder in the pool
    expect(await pool.liquidityPoolAssets()).to.equal(80_000 * scale + 2);

    // Check attacker can withdraw full amount
    const maxAttackerWithdraw = await pool.maxWithdraw(attacker.address);
    expect(maxAttackerWithdraw).to.equal(20_010 * scale - 2);

    // Attacker withdraws
    let txn = await pool
      .connect(attacker)
      .withdraw(maxAttackerWithdraw, attacker.address, attacker.address);
    // Sanity check that the withdrawal completed
    await expect(txn).to.changeTokenBalances(
      mockERC20,
      [pool.address, attacker.address],
      [-maxAttackerWithdraw, +maxAttackerWithdraw]
    );

    // Lender requests to withdraw full amount
    // 20_000 is available to service withdrawals
    expect(await pool.liquidityPoolAssets()).to.equal(80_000 * scale + 2);
    await pool.connect(lenderOne).requestRedeem(depositAmount);
    await time.increase(month);
    await pool.snapshot();

    // check max withdrawal
    expect(await pool.maxWithdraw(lenderOne.address)).to.equal(0);
    await pool.connect(lenderOne).claimSnapshots(1);
    // Lender can withdraw exactly half, 20_000
    expect(await pool.maxWithdraw(lenderOne.address)).to.equal(
      depositAmount / 2
    );

    // Pool now has 60_000 + dust
    expect(await pool.liquidityPoolAssets()).to.equal(60_000 * scale + 2);

    await pool.connect(lenderTwo).requestRedeem(depositAmount);
    await time.increase(month);

    // 15_000 will be allocated to service withdrawal requests.
    // LenderOne has 20_000 outstanding, and lenderTwo has 40_000 outstanding
    // LenderOne will therefore receive 5_000 (aka 1/3)
    // LenderTwo  will therefore receive 10_000 (aka 2/3)
    await pool.snapshot();
    // Prior to claiming
    expect(await pool.maxWithdraw(lenderOne.address)).to.equal(
      depositAmount / 2
    );
    expect(await pool.maxWithdraw(lenderTwo.address)).to.equal(0);

    // Claim
    await pool.connect(lenderOne).claimSnapshots(1);
    await pool.connect(lenderTwo).claimSnapshots(1);

    const lenderOneEarnings = depositAmount / 2 + 5_000 * scale;
    const lenderTwoEarnings = 10_000 * scale;
    expect(await pool.maxWithdraw(lenderOne.address)).to.equal(
      lenderOneEarnings
    );
    expect(await pool.maxWithdraw(lenderTwo.address)).to.equal(
      lenderTwoEarnings
    );

    // sanity check the withdrawal can complete
    txn = await pool
      .connect(lenderOne)
      .withdraw(lenderOneEarnings, lenderOne.address, lenderOne.address);
    await expect(txn).to.not.be.reverted;
    // Sanity check that the ERC20 moved
    await expect(txn).to.changeTokenBalances(
      mockERC20,
      [pool.address, lenderOne.address],
      [-lenderOneEarnings, +lenderOneEarnings]
    );

    txn = await pool
      .connect(lenderTwo)
      .withdraw(lenderTwoEarnings, lenderTwo.address, lenderTwo.address);
    await expect(txn).to.not.be.reverted;
    // Sanity check that the ERC20 moved
    await expect(txn).to.changeTokenBalances(
      mockERC20,
      [pool.address, lenderTwo.address],
      [-lenderTwoEarnings, +lenderTwoEarnings]
    );
  });
});
