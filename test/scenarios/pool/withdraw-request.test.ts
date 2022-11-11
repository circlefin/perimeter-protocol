import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Withdraw Requests", () => {
  async function loadPoolFixture() {
    const [operator, poolAdmin, aliceLender, bobLender] =
      await ethers.getSigners();
    const { pool, liquidityAsset } = await deployPool({
      operator,
      poolAdmin: poolAdmin
    });

    // Set the request fee to 10%
    await pool.connect(poolAdmin).setRequestFee(1000);

    // Set the withdraw gate to 25%
    await pool.connect(poolAdmin).setWithdrawGate(2500);

    // activate the pool
    await activatePool(pool, poolAdmin, liquidityAsset);

    // deposit 100 tokens from Alice
    await depositToPool(pool, aliceLender, liquidityAsset, 100);

    // deposit 70 tokens from Bob
    await depositToPool(pool, bobLender, liquidityAsset, 70);

    return {
      pool,
      liquidityAsset,
      poolAdmin,
      aliceLender,
      bobLender
    };
  }

  it("allows requesting of a withdraw", async () => {
    const { pool, aliceLender, bobLender } = await loadFixture(loadPoolFixture);
    const { withdrawRequestPeriodDuration } = await pool.settings();

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
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(0);
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(0);

    // Verify Bob's withdrawal state is updated
    expect(await pool.requestedBalanceOf(bobLender.address)).to.equal(10);
    expect(await pool.eligibleBalanceOf(bobLender.address)).to.equal(0);
    expect(await pool.maxRedeem(bobLender.address)).to.equal(0);
    expect(await pool.maxWithdraw(bobLender.address)).to.equal(0);

    // Verify the Global withdrawal state is updated
    expect(await pool.totalRequestedBalance()).to.equal(60);
    expect(await pool.totalEligibleBalance()).to.equal(0);
    expect(await pool.totalRedeemableShares()).to.equal(0);
    expect(await pool.totalWithdrawableAssets()).to.equal(0);

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
    expect(await pool.withdrawPeriod()).to.equal(1);

    // nothing changes until we crank
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(0);
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(0);

    // crank it
    await pool.crank();

    // 170 assets = 160 shares. 25% withdraw gate = 40
    expect(await pool.totalRedeemableShares()).to.equal(40);
    expect(await pool.totalWithdrawableAssets()).to.equal(41);

    // verify the global state is updated
    expect(await pool.totalRequestedBalance()).to.equal(0);
    expect(await pool.totalEligibleBalance()).to.equal(20); /* 60 - 40 */

    // verify Alice's state is updated
    expect(await pool.maxRedeem(aliceLender.address)).to.equal(
      33
    ); /* 50 * (40/60) */
    expect(await pool.maxWithdraw(aliceLender.address)).to.equal(33);

    // verify Bob's state is updated
    expect(await pool.maxRedeem(bobLender.address)).to.equal(
      6
    ); /* 10 * (41/60) */
    expect(await pool.maxWithdraw(bobLender.address)).to.equal(6);

    // Cancel a request
    expect(await pool.maxRequestCancellation(aliceLender.address)).to.equal(16);
    expect(await pool.maxRequestCancellation(bobLender.address)).to.equal(3);

    // Cancel Bob's request
    expect(await pool.connect(bobLender).cancelRedeemRequest(3));
    expect(await pool.maxRequestCancellation(bobLender.address)).to.equal(0);
  });
});
