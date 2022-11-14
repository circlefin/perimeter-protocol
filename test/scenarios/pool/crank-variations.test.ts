import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Crank Variations", () => {
  const DEPOSIT_AMOUNT = 1_000_000;

  async function loadPoolFixture() {
    const [operator, poolAdmin, aliceLender, bobLender] =
      await ethers.getSigners();

    const { pool, liquidityAsset } = await deployPool({
      operator,
      poolAdmin: poolAdmin
    });

    // Set the request fee to 0, for simplicity
    await pool.connect(poolAdmin).setRequestFee(0);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 1M tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, DEPOSIT_AMOUNT);

    const { withdrawRequestPeriodDuration } = await pool.settings();

    return {
      pool,
      liquidityAsset,
      poolAdmin,
      aliceLender,
      withdrawRequestPeriodDuration
    };
  }

  it.only("calculates correctly from a request before the first snapshot", async () => {
    const { pool, aliceLender, poolAdmin, withdrawRequestPeriodDuration } =
      await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 25%
    await pool.connect(poolAdmin).setWithdrawGate(5000);

    // Request maximum in window 0
    expect(await pool.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward 1st period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await pool.withdrawPeriod()).to.equal(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    ); // 500k

    // Fast forward to 2nd period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await pool.withdrawPeriod()).to.equal(2);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      (3 * DEPOSIT_AMOUNT) / 4
    ); // 500k + (remainder = 500k) / 2 = 750k

    // Fast forward to 3rd period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await pool.withdrawPeriod()).to.equal(3);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(875_000); // 750k + (remainder = 250k) / 2 = 875k

    // Fast forward to 4th period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await pool.withdrawPeriod()).to.equal(4);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(937_500); // 875k + (remainder = 125k) / 2 = 875k

    // Fast forward to pool close date
    const { endDate } = await pool.settings();
    await time.increaseTo(endDate);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(DEPOSIT_AMOUNT);
  });
});
