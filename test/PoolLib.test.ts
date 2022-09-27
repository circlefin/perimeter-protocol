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

    const PoolLibWrapper = await ethers.getContractFactory(
      "PoolLibTestWrapper",
      {
        libraries: {
          PoolLib: poolLib.address
        }
      }
    );
    const poolLibWrapper = await PoolLibWrapper.deploy();
    await poolLibWrapper.deployed();

    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC");
    await liquidityAsset.deployed();

    await liquidityAsset.mint(caller.address, FIRST_LOSS_AMOUNT);
    await liquidityAsset
      .connect(caller)
      .approve(poolLibWrapper.address, FIRST_LOSS_AMOUNT);

    return {
      poolLibWrapper,
      caller,
      firstLossVault,
      liquidityAsset
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
      const { poolLibWrapper, liquidityAsset, firstLossVault } =
        await loadFixture(deployFixture);

      // Confirm vault is empty
      expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(
        0
      );

      expect(
        await poolLibWrapper.executeFirstLossContribution(
          liquidityAsset.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          0,
          0
        )
      ).to.emit(poolLibWrapper, "FirstLossSupplied");

      // Check balance of vault
      expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(
        FIRST_LOSS_AMOUNT
      );
    });

    it("graduates PoolLifeCycleState if threshold is met, and initial state is Initialized", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault } =
        await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.executeFirstLossContribution(
          liquidityAsset.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          0,
          FIRST_LOSS_AMOUNT // minimum required first loss
        )
      ).to.emit(poolLibWrapper, "LifeCycleStateTransition");
    });

    it("does not graduate PoolLifeCycleState if threshold is not met, and initial state is Initialized", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault } =
        await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.executeFirstLossContribution(
          liquidityAsset.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          0,
          FIRST_LOSS_AMOUNT - 1
        )
      ).to.not.emit(poolLibWrapper, "LifeCycleStateTransition");
    });

    it("does not graduate PoolLifeCycleState if not in Initialized", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault } =
        await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.executeFirstLossContribution(
          liquidityAsset.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          1, // Already active
          FIRST_LOSS_AMOUNT
        )
      ).to.not.emit(poolLibWrapper, "LifeCycleStateTransition");
    });
  });

  describe("calculateNav()", async () => {
    it("deducts withdrawals from total assets", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      expect(await poolLibWrapper.calculateNav(100, 25)).to.equal(75);
    });
  });

  describe("calculateTotalAssets()", async () => {
    it("combines balance of vault with oustanding loan principals", async () => {
      const { poolLibWrapper, liquidityAsset, caller } = await loadFixture(
        deployFixture
      );

      liquidityAsset.mint(poolLibWrapper.address, 200);

      expect(
        await poolLibWrapper.calculateTotalAssets(
          liquidityAsset.address,
          poolLibWrapper.address,
          50
        )
      ).to.equal(250);
    });
  });

  describe("executeDeposit()", async () => {
    it("reverts if shares to be minted are 0", async () => {
      const { poolLibWrapper, liquidityAsset, caller } = await loadFixture(
        deployFixture
      );

      await expect(
        poolLibWrapper.executeDeposit(
          liquidityAsset.address,
          poolLibWrapper.address,
          caller.address,
          10,
          0,
          10
        )
      ).to.be.revertedWith("Pool: 0 deposit not allowed");
    });

    it("reverts deposit exceeds maximum allowed deposit", async () => {
      const { poolLibWrapper, liquidityAsset, caller } = await loadFixture(
        deployFixture
      );

      await expect(
        poolLibWrapper.executeDeposit(
          liquidityAsset.address,
          poolLibWrapper.address,
          caller.address,
          10,
          5,
          9 // max
        )
      ).to.be.revertedWith("Pool: Exceeds max deposit");
    });

    it("transfers deposited assets to the vault", async () => {
      const { poolLibWrapper, liquidityAsset, caller } = await loadFixture(
        deployFixture
      );

      const callerBalancePrior = await liquidityAsset.balanceOf(caller.address);
      const depositAmount = 10;

      await expect(
        poolLibWrapper.executeDeposit(
          liquidityAsset.address,
          poolLibWrapper.address,
          caller.address,
          depositAmount,
          5,
          10
        )
      ).to.emit(poolLibWrapper, "Deposit");

      // Check that caller lost deposited amount
      expect(await liquidityAsset.balanceOf(caller.address)).to.equal(
        callerBalancePrior.sub(depositAmount)
      );
      // Check that pool received it
      expect(await liquidityAsset.balanceOf(poolLibWrapper.address)).to.equal(
        depositAmount
      );
    });
  });

  describe("calculateMaxDeposit()", async () => {
    it("returns 0 if pool is not in active state", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const maxCapacity = 1000;
      const poolAssets = 500;

      // check states 0, 2, 3 (except for state == 1, aka active)
      let poolStatesNotAllowingDeposits = [0, 2, 3];
      poolStatesNotAllowingDeposits.forEach(async (poolState) => {
        expect(
          await poolLibWrapper.calculateMaxDeposit(
            poolState,
            maxCapacity,
            poolAssets
          )
        ).to.equal(0);
      });
    });

    it("returns remaining pool capacity if pool is active", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const maxCapacity = 1000;
      const poolAssets = 500;
      const activePoolState = 1;

      expect(
        await poolLibWrapper.calculateMaxDeposit(
          activePoolState,
          maxCapacity,
          poolAssets
        )
      ).to.equal(maxCapacity - poolAssets);
    });
  });

  describe("calculateAssetsToShares()", async () => {
    it("calculates 1:1 shares if token supply is zero", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      expect(await poolLibWrapper.calculateAssetsToShares(500, 0, 0)).to.equal(
        500
      );
    });

    it("calculates <1:1 if nav has increased in value", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.calculateAssetsToShares(500, 500, 525)
      ).to.equal(476);
    });

    it("calculates >1:1 if nav has decreased in value", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.calculateAssetsToShares(500, 500, 400)
      ).to.equal(625);
    });
  });
});
