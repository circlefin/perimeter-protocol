import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Withdraw Requests", () => {
  async function loadPoolFixture() {
    const [poolManager, aliceLender, bobLender] = await ethers.getSigners();
    const { pool, liquidityAsset } = await deployPool(poolManager);

    // Set the request fee to 10%
    await pool.setRequestFee(1000);

    // Set the withdraw gate to 25%
    await pool.setWithdrawGate(2500);

    // activate the pool
    await activatePool(pool, poolManager, liquidityAsset);

    // deposit 100 tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, 100);

    // deposit 70 tokens from Bob
    await depositToPool(pool, bobLender, liquidityAsset, 70);

    return { pool, liquidityAsset, poolManager, aliceLender, bobLender };
  }

  it("allows requesting of a withdraw", async () => {
    const { pool, aliceLender, bobLender } = await loadFixture(loadPoolFixture);
    const { withdrawRequestPeriodDuration } = await pool.settings();

    // Expect the pool just started, and nothing can be withdrawn
    expect(await pool.withdrawPeriod()).to.equal(0);

    // Expect Alice to be able to request her full balance, minus fees
    // TODO: Update this to have a non 1:1 ratio!
    expect(await pool.maxRedeemRequest(aliceLender.address)).to.equal(90);
    expect(await pool.maxWithdrawRequest(aliceLender.address)).to.equal(90);

    // Expect Bob to be able to request his full balance, minus fees
    expect(await pool.maxRedeemRequest(bobLender.address)).to.equal(63);
    expect(await pool.maxWithdrawRequest(bobLender.address)).to.equal(63);

    // Request a withdraw from Alice for Period n + 1 (in this case, 1)
    expect(await pool.connect(aliceLender).requestWithdraw(50))
      .to.emit(pool.address, "WithdrawRequested")
      .withArgs(aliceLender.address, 50);

    // Request a Redeem from Bob for Period n + 1 (in this case, 1)
    expect(await pool.connect(bobLender).requestRedeem(10))
      .to.emit(pool.address, "RedeemRequested")
      .withArgs(bobLender.address, 10);

    // Ensure a fee was paid (10% of 60 = 6 tokens)
    expect(await pool.totalSupply()).to.equal(164);
    expect(await pool.totalAssets()).to.equal(170); // unchanged
    expect(await pool.balanceOf(aliceLender.address)).to.equal(95);
    expect(await pool.balanceOf(bobLender.address)).to.equal(69);

    // Verify Alice's withdrawal state is updated
    expect(await pool.requestedBalanceOf(aliceLender.address)).to.equal(50);
    expect(await pool.eligibleBalanceOf(aliceLender.address)).to.equal(0);
    expect(await pool.redeemableBalanceOf(aliceLender.address)).to.equal(0);
    expect(await pool.withdrawableBalanceOf(aliceLender.address)).to.equal(0);

    // Verify Bob's withdrawal state is updated
    expect(await pool.requestedBalanceOf(bobLender.address)).to.equal(10);
    expect(await pool.eligibleBalanceOf(bobLender.address)).to.equal(0);
    expect(await pool.redeemableBalanceOf(bobLender.address)).to.equal(0);
    expect(await pool.withdrawableBalanceOf(bobLender.address)).to.equal(0);

    // Verify the Global withdrawal state is updated
    expect(await pool.totalRequestedBalance()).to.equal(60);
    expect(await pool.totalEligibleBalance()).to.equal(0);
    expect(await pool.totalRedeemableBalance()).to.equal(0);
    expect(await pool.totalWithdrawableBalance()).to.equal(0);

    // Expect Alice's maxWithdrawRequest amounts have decreased
    expect(await pool.maxRedeemRequest(aliceLender.address)).to.equal(
      // TODO: Rounding. See `PoolLib.cacluclateRequestFee`
      Math.ceil(
        (100 /* initial balance */ -
          50 /* requested */ -
          5) /* previous request fee */ *
          0.9 /* sub the request fee */
      )
    );
    expect(await pool.maxWithdrawRequest(aliceLender.address)).to.equal(42);

    // Expect Bob's maxWithdrawRequest amounts have decreased
    expect(await pool.maxRedeemRequest(bobLender.address)).to.equal(
      // TODO: Rounding. See `PoolLib.cacluclateRequestFee`
      Math.ceil(
        (70 /* initial balance */ -
          10 /* requested */ -
          1) /* previous request fee */ *
          0.9 /* sub the request fee */
      )
    );
    expect(await pool.maxWithdrawRequest(bobLender.address)).to.equal(55);

    // Skip ahead to the next window
    await time.increase(withdrawRequestPeriodDuration);

    // expect the request and withdraw periods to have advanced
    expect(await pool.withdrawPeriod()).to.equal(1);

    // nothing changes until we crank
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(0);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(0);

    // crank it
    await pool.crank();

    // 48 shares should be available due to 25% withdraw gate.
    expect(await pool.totalRedeemableBalance()).to.equal(41);

    // verify the global state is updated
    expect(await pool.totalRequestedBalance()).to.equal(0);
    expect(await pool.totalEligibleBalance()).to.equal(19); /* 60 - 41 */
    expect(await pool.totalWithdrawableBalance()).to.equal(42);

    // verify Alice's state is updated
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      34
    ); /* 50 * (41/60) */
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(35);

    // verify Bob's state is updated
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      6
    ); /* 10 * (41/60) */
    expect(await pool.maxWithdraw(bobLender.address)).to.equal(6);
  });
});
