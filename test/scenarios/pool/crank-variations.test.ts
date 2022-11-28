import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Crank Variations", () => {
  const DEPOSIT_AMOUNT = 1_000_000;

  async function loadPoolFixture() {
    const [operator, poolAdmin, aliceLender, bobLender] =
      await ethers.getSigners();

    const { pool, liquidityAsset, withdrawController, poolController } =
      await deployPool({
        operator,
        poolAdmin: poolAdmin
      });

    // Set the request fee to 0, for simplicity
    await poolController.connect(poolAdmin).setRequestFee(0);

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
      poolController
    } = await loadFixture(loadPoolFixture);

    // Set the withdraw gate to 25%
    await poolController.connect(poolAdmin).setWithdrawGate(5000);

    // Request maximum in window 0
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward 1st period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    ); // 500k

    // Fast forward to 2nd period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await withdrawController.withdrawPeriod()).to.equal(2);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      (3 * DEPOSIT_AMOUNT) / 4
    ); // 500k + (remainder = 500k) / 2 = 750k

    // Fast forward to 3rd period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await withdrawController.withdrawPeriod()).to.equal(3);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(875_000); // 750k + (remainder = 250k) / 2 = 875k

    // Fast forward to 4th period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await withdrawController.withdrawPeriod()).to.equal(4);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(937_500); // 875k + (remainder = 125k) / 2 = 875k

    // Fast forward to pool close date
    const { endDate } = await pool.settings();
    await time.increaseTo(endDate);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );
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

    // deposit 1M tokens from Bob as well
    await depositToPool(pool, bobLender, liquidityAsset, DEPOSIT_AMOUNT);

    // Set the withdraw gate to 50%
    await poolController.connect(poolAdmin).setWithdrawGate(5000);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward to 1st period. Pool is cranked, earmarking a full 1M for Alice.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    await pool.crank(); // 1M should be earmarked
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // Fast forward to 2nd period. Pool is cranked, and then Bob requests their full amount.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(2);
    await pool.crank();
    await pool.connect(bobLender).requestRedeem(DEPOSIT_AMOUNT);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(0);

    // Fast forward to 3rd period. Pool is cranked,
    await time.increase(withdrawRequestPeriodDuration);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(0);
    await pool.crank(); // Bob should now be able to withdraw 1M / 2 = 500k
    expect(await withdrawController.withdrawPeriod()).to.equal(3);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2 - 1
    );

    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // Fast forward to 4th period
    await time.increase(withdrawRequestPeriodDuration);
    await pool.crank();
    expect(await withdrawController.withdrawPeriod()).to.equal(4);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      (3 * DEPOSIT_AMOUNT) / 4 - 1
    );
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // Fast forward to pool close date
    const { endDate } = await pool.settings();
    await time.increaseTo(endDate);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // check that they can actually withdraw
    await pool
      .connect(aliceLender)
      .redeem(DEPOSIT_AMOUNT - 1, aliceLender.address, aliceLender.address);
    await pool
      .connect(bobLender)
      .redeem(DEPOSIT_AMOUNT - 1, bobLender.address, bobLender.address);
    expect(await liquidityAsset.balanceOf(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );
    expect(await liquidityAsset.balanceOf(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
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

    // Set the withdraw gate to 50%
    await poolController.connect(poolAdmin).setWithdrawGate(5000);

    // Request maximum in window 0 for Alice
    expect(await withdrawController.withdrawPeriod()).to.equal(0);
    await pool.connect(aliceLender).requestRedeem(DEPOSIT_AMOUNT);

    // Fast forward to 1st period. Pool is cranked, earmarking a full 1M for Alice.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(1);
    await pool.crank(); // 1M should be earmarked
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2
    );

    // Fast forward to 2nd period. Pool is cranked, and then Bob requests their full amount.
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(2);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      (DEPOSIT_AMOUNT * 3) / 4
    );

    // Now deposit enough from Bob to fulfill the request
    await depositToPool(pool, bobLender, liquidityAsset, DEPOSIT_AMOUNT);
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(3);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // Ensure that subsequent cranks dont over allocate
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(4);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // Once again, with a request from Bob mixed in
    await pool.connect(bobLender).requestRedeem(DEPOSIT_AMOUNT);
    await time.increase(withdrawRequestPeriodDuration);
    expect(await withdrawController.withdrawPeriod()).to.equal(5);
    await pool.crank();
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      DEPOSIT_AMOUNT - 1
    );

    // sanity check bob too; they should receive 1/2, since they requested before the last snapshot, which earmarked 50% of 1M - dust
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      DEPOSIT_AMOUNT / 2 - 1
    );
  });
});
