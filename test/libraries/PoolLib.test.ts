import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployPool,
  DEFAULT_POOL_SETTINGS,
  depositToPool,
  activatePool
} from "../support/pool";
import { deployLoan } from "../support/loan";
import { deployMockERC20 } from "../support/erc20";

describe("PoolLib", () => {
  const FIRST_LOSS_AMOUNT = 100;

  async function deployFixture() {
    const [caller, otherAccount] = await ethers.getSigners();

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

    const liquidityAsset = (await deployMockERC20()).mockERC20;

    await liquidityAsset.mint(caller.address, FIRST_LOSS_AMOUNT);
    await liquidityAsset
      .connect(caller)
      .approve(poolLibWrapper.address, FIRST_LOSS_AMOUNT);

    const FirstLossVault = await ethers.getContractFactory("FirstLossVault");
    const firstLossVault = await FirstLossVault.deploy(
      poolLibWrapper.address,
      liquidityAsset.address
    );
    await firstLossVault.deployed();

    const { loan, loanFactory, serviceConfiguration } = await deployLoan(
      poolLibWrapper.address,
      otherAccount.address,
      0
    );

    return {
      poolLibWrapper,
      caller,
      firstLossVault,
      liquidityAsset,
      otherAccount,
      loanFactory,
      loan,
      serviceConfiguration
    };
  }

  describe("executeFirstLossDeposit()", async () => {
    it("guards against transfers to null address", async () => {
      const { poolLibWrapper, liquidityAsset, caller } = await loadFixture(
        deployFixture
      );

      await expect(
        poolLibWrapper
          .connect(caller)
          .executeFirstLossDeposit(
            liquidityAsset.address,
            caller.address,
            FIRST_LOSS_AMOUNT,
            ethers.constants.AddressZero,
            0,
            0
          )
      ).to.be.revertedWith("Pool: 0 address");
    });

    it("transfers liquidity to vault", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault, caller } =
        await loadFixture(deployFixture);

      // Confirm vault is empty
      expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(
        0
      );

      expect(
        await poolLibWrapper
          .connect(caller)
          .executeFirstLossDeposit(
            liquidityAsset.address,
            caller.address,
            FIRST_LOSS_AMOUNT,
            firstLossVault.address,
            0,
            0
          )
      ).to.emit(poolLibWrapper, "FirstLossDeposited");

      // Check balance of vault
      expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(
        FIRST_LOSS_AMOUNT
      );
    });

    it("transfers liquidity to vault from a supplier", async () => {
      const {
        poolLibWrapper,
        liquidityAsset,
        firstLossVault,
        caller,
        otherAccount
      } = await loadFixture(deployFixture);

      // Transfer caller balance to another account
      const callerBalance = await liquidityAsset.balanceOf(caller.address);
      await liquidityAsset
        .connect(caller)
        .transfer(otherAccount.address, callerBalance);
      expect(await liquidityAsset.balanceOf(caller.address)).to.equal(0);

      // Make approval from otherAccount
      await liquidityAsset
        .connect(otherAccount)
        .approve(poolLibWrapper.address, callerBalance);

      expect(
        await poolLibWrapper
          .connect(caller)
          .executeFirstLossDeposit(
            liquidityAsset.address,
            otherAccount.address,
            FIRST_LOSS_AMOUNT,
            firstLossVault.address,
            0,
            0
          )
      ).to.emit(poolLibWrapper, "FirstLossDeposited");

      // Check balance of vault
      expect(await liquidityAsset.balanceOf(firstLossVault.address)).to.equal(
        FIRST_LOSS_AMOUNT
      );
    });

    it("graduates PoolLifeCycleState if threshold is met, and initial state is Initialized", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault, caller } =
        await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.connect(caller).executeFirstLossDeposit(
          liquidityAsset.address,
          caller.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          0,
          FIRST_LOSS_AMOUNT // minimum required first loss
        )
      ).to.emit(poolLibWrapper, "LifeCycleStateTransition");
    });

    it("does not graduate PoolLifeCycleState if threshold is not met, and initial state is Initialized", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault, caller } =
        await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.executeFirstLossDeposit(
          liquidityAsset.address,
          caller.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          0,
          FIRST_LOSS_AMOUNT - 1
        )
      ).to.not.emit(poolLibWrapper, "LifeCycleStateTransition");
    });

    it("does not graduate PoolLifeCycleState if not in Initialized", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault, caller } =
        await loadFixture(deployFixture);

      expect(
        await poolLibWrapper.executeFirstLossDeposit(
          liquidityAsset.address,
          caller.address,
          FIRST_LOSS_AMOUNT,
          firstLossVault.address,
          1, // Already active
          FIRST_LOSS_AMOUNT
        )
      ).to.not.emit(poolLibWrapper, "LifeCycleStateTransition");
    });
  });

  describe("executeFirstLossWithdraw()", async () => {
    it("transfers funds to receiver address", async () => {
      const { poolLibWrapper, liquidityAsset, firstLossVault, otherAccount } =
        await loadFixture(deployFixture);

      // Load up vault
      const withdrawAmount = 1000;
      await liquidityAsset.mint(firstLossVault.address, withdrawAmount);

      // Check balance prior
      const receiverBalancePrior = await liquidityAsset.balanceOf(
        otherAccount.address
      );

      expect(
        await poolLibWrapper.executeFirstLossWithdraw(
          withdrawAmount,
          otherAccount.address,
          firstLossVault.address
        )
      ).to.emit(poolLibWrapper, "FirstLossWithdrawal");

      // Check balance after
      expect(await liquidityAsset.balanceOf(otherAccount.address)).to.equal(
        receiverBalancePrior.add(withdrawAmount)
      );
    });
  });

  describe("calculateTotalAssets()", async () => {
    it("combines balance of vault with oustanding loan principals", async () => {
      const { poolLibWrapper, liquidityAsset } = await loadFixture(
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

      // Check that shares were minted
      expect(await poolLibWrapper.balanceOf(caller.address)).to.equal(5);
    });
  });

  describe("calculateMaxDeposit()", async () => {
    it("returns 0 if pool is not in active state", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const maxCapacity = 1000;
      const poolAssets = 500;

      // check states 0, 2, 3 (except for state == 1, aka active)
      const poolStatesNotAllowingDeposits = [0, 2, 3];
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

  describe("calculateSharesToAssets()", async () => {
    it("calculates 1:1 assets if token supply is zero", async () => {
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

  describe("isPoolLoan()", async () => {
    it("reverts if not passed an ILoan", async () => {
      const { poolLibWrapper, serviceConfiguration, caller } =
        await loadFixture(deployFixture);

      await expect(
        poolLibWrapper.isPoolLoan(
          caller.address,
          serviceConfiguration.address,
          poolLibWrapper.address
        )
      ).to.be.reverted;
    });

    it("reverts if not passed a service configuration", async () => {
      const { poolLibWrapper, loan } = await loadFixture(deployFixture);

      await expect(
        poolLibWrapper.isPoolLoan(
          loan.address,
          loan.address,
          poolLibWrapper.address
        )
      ).to.be.reverted;
    });

    it("returns true if conditions are met", async () => {
      const { poolLibWrapper, loan, serviceConfiguration } = await loadFixture(
        deployFixture
      );

      expect(
        await poolLibWrapper.isPoolLoan(
          loan.address,
          serviceConfiguration.address,
          poolLibWrapper.address
        )
      ).to.equal(true);
    });
  });

  describe("isPoolLoan()", async () => {
    it("reverts if not passed an ILoan", async () => {
      const { poolLibWrapper, serviceConfiguration, caller } =
        await loadFixture(deployFixture);

      await expect(
        poolLibWrapper.isPoolLoan(
          caller.address,
          serviceConfiguration.address,
          poolLibWrapper.address
        )
      ).to.be.reverted;
    });

    it("reverts if not passed a service configuration", async () => {
      const { poolLibWrapper, loan } = await loadFixture(deployFixture);

      await expect(
        poolLibWrapper.isPoolLoan(
          loan.address,
          loan.address,
          poolLibWrapper.address
        )
      ).to.be.reverted;
    });

    it("returns true if conditions are met", async () => {
      const { poolLibWrapper, loan, serviceConfiguration } = await loadFixture(
        deployFixture
      );

      expect(
        await poolLibWrapper.isPoolLoan(
          loan.address,
          serviceConfiguration.address,
          poolLibWrapper.address
        )
      ).to.equal(true);
    });
  });
});
