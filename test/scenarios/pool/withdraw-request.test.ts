import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Withdraw Requests", () => {
  async function loadPoolFixture() {
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { pool, liquidityAsset } = await deployPool(poolManager);

    // Set the request fee to 10%
    await pool.setRequestFee(1000);

    // activate the pool
    await activatePool(pool, poolManager, liquidityAsset);

    // deposit 100 tokens
    await depositToPool(pool, otherAccount, liquidityAsset, 100);

    return { pool, liquidityAsset, poolManager, otherAccount };
  }

  it("allows requesting of a withdraw", async () => {
    const { pool, otherAccount } = await loadFixture(loadPoolFixture);

    const { withdrawRequestPeriodDuration } = await pool.settings();

    expect(await pool.withdrawPeriod()).to.equal(0);

    // Expect the lender to be able to request the full balance, minus fees
    // TODO: Update this to have a non 1:1 ratio!
    expect(await pool.maxRedeemRequest(otherAccount.address)).to.equal(90);
    expect(await pool.maxWithdrawRequest(otherAccount.address)).to.equal(90);

    // Request a withdraw for Period n + 1 (in this case, 1)
    // 10% fee is 5 shares
    expect(await pool.connect(otherAccount).requestWithdraw(50))
      .to.emit(pool.address, "WithdrawRequested")
      .withArgs(otherAccount.address, 50);

    // Ensure a fee was paid (10% of 50 = 5 tokens)
    expect(await pool.totalSupply()).to.equal(95);
    expect(await pool.totalAssets()).to.equal(100); // unchanged
    expect(await pool.balanceOf(otherAccount.address)).to.equal(95);

    // Verify the withdrawal state is updated
    expect(await pool.requestedBalanceOf(otherAccount.address)).to.equal(50);
    expect(await pool.eligibleBalanceOf(otherAccount.address)).to.equal(0);
    expect(await pool.totalRequestedBalance()).to.equal(50);
    expect(await pool.totalEligibleBalance()).to.equal(0);

    // Expect the lender maxWithdraw amounts have decreased
    expect(await pool.maxRedeemRequest(otherAccount.address)).to.equal(41);
    expect(await pool.maxWithdrawRequest(otherAccount.address)).to.equal(43);

    // Skip ahead to the next window
    await time.increase(withdrawRequestPeriodDuration);

    // expect the request and withdraw periods to have advanced
    expect(await pool.withdrawPeriod()).to.equal(1);
  });
});
