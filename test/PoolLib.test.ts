import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolLib", () => {

    const FIRST_LOSS_AMOUNT = 100;

    async function deployFixture() {
        const [caller, firstLossVault] = await ethers.getSigners();

        const PoolLib = await ethers.getContractFactory("PoolLib");
        const poolLib = await PoolLib.deploy();
        await poolLib.deployed();

        const PoolLibWrapper = await ethers.getContractFactory("PoolLibTestWrapper", {
            libraries: {
                PoolLib: poolLib.address
            }
        });
        const poolLibWrapper = await PoolLibWrapper.deploy();
        await poolLibWrapper.deployed();

        const LiquidityAsset = await ethers.getContractFactory("MockERC20");
        const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC");
        await liquidityAsset.deployed();

        await liquidityAsset.mint(caller.address, FIRST_LOSS_AMOUNT);
        await liquidityAsset.connect(caller).approve(poolLibWrapper.address, FIRST_LOSS_AMOUNT)

        return {
            poolLibWrapper, caller, firstLossVault, liquidityAsset
        };
    }

    describe("executeFirstLossContribution()", async () => {
        it("guards against transfers to null address", async () => {
            const { poolLibWrapper, liquidityAsset } = await loadFixture(
                deployFixture
            );

            await expect(
                poolLibWrapper.executeFirstLossContribution(
                    liquidityAsset.address,
                    FIRST_LOSS_AMOUNT,
                    ethers.constants.AddressZero,
                    0,
                    0
                )
            ).to.be.revertedWith("Pool: 0 address");
        });

        it("transfers liquidity to vault", async () => {
            const { poolLibWrapper, liquidityAsset, firstLossVault } = await loadFixture(
                deployFixture
            );

            // Confirm vault is empty 
            expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(0);

            expect(await poolLibWrapper.executeFirstLossContribution(
                liquidityAsset.address,
                FIRST_LOSS_AMOUNT,
                firstLossVault.address,
                0,
                0
            )).to.emit(poolLibWrapper, "FirstLossSupplied");

            // Check balance of vault 
            expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(FIRST_LOSS_AMOUNT);
        });

        it("graduates PoolLifeCycleState if threshold is met, and initial state is Initialized", async () => {
            const { poolLibWrapper, liquidityAsset, firstLossVault } = await loadFixture(
                deployFixture
            );

            expect(await poolLibWrapper.executeFirstLossContribution(
                liquidityAsset.address,
                FIRST_LOSS_AMOUNT,
                firstLossVault.address,
                0,
                FIRST_LOSS_AMOUNT // minimum required first loss
            )).to.emit(poolLibWrapper, "LifeCycleStateTransition");
        });

        it("does not graduate PoolLifeCycleState if threshold is not met, and initial state is Initialized", async () => {
            const { poolLibWrapper, liquidityAsset, firstLossVault } = await loadFixture(
                deployFixture
            );

            expect(await poolLibWrapper.executeFirstLossContribution(
                liquidityAsset.address,
                FIRST_LOSS_AMOUNT,
                firstLossVault.address,
                0,
                FIRST_LOSS_AMOUNT - 1
            )).to.not.emit(poolLibWrapper, "LifeCycleStateTransition");
        });

        it("does not graduate PoolLifeCycleState if not in Initialized", async () => {
            const { poolLibWrapper, liquidityAsset, firstLossVault } = await loadFixture(
                deployFixture
            );

            expect(await poolLibWrapper.executeFirstLossContribution(
                liquidityAsset.address,
                FIRST_LOSS_AMOUNT,
                firstLossVault.address,
                1, // Already active
                FIRST_LOSS_AMOUNT
            )).to.not.emit(poolLibWrapper, "LifeCycleStateTransition");
        });
    });
});
