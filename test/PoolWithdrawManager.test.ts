import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployPool,
    depositToPool,
    activatePool
} from "./support/pool";

describe("PoolWithdrawManager", () => {

    const LENDER_A_DEPOSIT = 1_000_000;

    async function loadPoolFixture() {
        const [operator, poolAdmin, lenderA, lenderB] =
            await ethers.getSigners();
        const { pool, liquidityAsset } = await deployPool({
            operator,
            poolAdmin: poolAdmin
        });

        await activatePool(pool, poolAdmin, liquidityAsset);
        const withdrawManager = await ethers.getContractAt("PoolWithdrawManager", await pool.withdrawManager());

        await liquidityAsset.mint(lenderA.address, LENDER_A_DEPOSIT);
        await liquidityAsset.connect(lenderA).approve(pool.address, LENDER_A_DEPOSIT);

        const { withdrawRequestPeriodDuration } = await pool.settings();

        return {
            pool,
            liquidityAsset,
            poolAdmin,
            lenderA,
            lenderB,
            withdrawManager,
            withdrawRequestPeriodDuration
        };
    }

    describe("needsCrank()", () => {
        it("returns true if lender needs crank", async () => {
            const { pool, withdrawManager, liquidityAsset, lenderA, withdrawRequestPeriodDuration } = await loadFixture(loadPoolFixture);

            await depositToPool(pool, lenderA, liquidityAsset, LENDER_A_DEPOSIT);
            await pool.connect(lenderA).requestRedeem(
                await pool.maxRedeemRequest(lenderA.address)
            );

            // Nothing to crank yet
            expect(await withdrawManager.needsCrank(lenderA.address)).to.be.false;

            // Fast forward a period 
            await time.increase(withdrawRequestPeriodDuration);

            // In the 2nd period, but the global crank hasn't run yet, 
            expect(await withdrawManager.needsCrank(lenderA.address)).to.be.false;

            // Still in the 2nd period, run the pool crank
            await pool.crankPool();
            expect(await withdrawManager.needsCrank(lenderA.address)).to.be.true;
        });
    });
});
