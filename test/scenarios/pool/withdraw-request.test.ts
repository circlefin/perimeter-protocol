import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, depositToPool, activatePool } from "../../support/pool";

describe("Withdraw Requests", () => {
  async function loadPoolFixture() {
    const [poolManager, otherAccount] = await ethers.getSigners();
    const { pool, liquidityAsset } = await deployPool(poolManager);

    await pool.setRequestFee(1000); // 10%

    // activate the pool
    await activatePool(pool, poolManager, liquidityAsset);

    // deposit 100 tokens
    await depositToPool(pool, otherAccount, liquidityAsset, 100);

    return { pool, liquidityAsset, poolManager, otherAccount };
  }

  it("allows requesting of a withdraw", async () => {
    const { pool, otherAccount } = await loadFixture(loadPoolFixture);

    const { withdrawRequestPeriodDuration } = await pool.settings();

    expect(await pool.requestPeriod()).to.equal(1);
    expect(await pool.withdrawPeriod()).to.equal(0);

    // Expect the lender to be able to request the full balance
    // TODO: Update this to have a non 1:1 ratio!
    expect(await pool.maxRedeemRequest(otherAccount.address)).to.equal(100);
    expect(await pool.maxWithdrawRequest(otherAccount.address)).to.equal(100);

    // Request a withdraw for Period n + 1 (in this case, 1)
    // TODO: Handle fees here
    expect(await pool.connect(otherAccount).requestWithdraw(50))
      .to.emit(pool.address, "WithdrawRequested")
      .withArgs(otherAccount.address, 50);

    // Verify the total for this period is set
    expect(await pool.totalRequestedBalance()).to.equal(50);
    expect(await pool.totalEligibleBalance()).to.equal(0);

    // Expect the lender can withdraw
    expect(await pool.maxWithdrawRequest(otherAccount.address)).to.equal(50);

    // Verify the per-lender amount is set
    expect(await pool.requestedBalanceOf(otherAccount.address)).to.equal(50);
    expect(await pool.eligibleBalanceOf(otherAccount.address)).to.equal(0);

    // Skip ahead to the next window
    await time.increase(withdrawRequestPeriodDuration);

    // expect the request and withdraw periods to have advanced
    expect(await pool.requestPeriod()).to.equal(2);
    expect(await pool.withdrawPeriod()).to.equal(1);
  });
});
