import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployLoan } from "../support/loan";
import { deployMockERC20 } from "../support/erc20";
import { buildWithdrawState } from "../support/pool";

describe("PoolLib", () => {
  const FIRST_LOSS_AMOUNT = 100;
  const ONE_MONTH_SECONDS = 3600 * 24 * 30;

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
      liquidityAsset.address
    );

    const MockILoan = await ethers.getContractFactory("MockILoan");
    const mockILoanOne = await MockILoan.deploy();
    await mockILoanOne.deployed();

    const mockILoanTwo = await MockILoan.deploy();
    await mockILoanTwo.deployed();

    return {
      poolLibWrapper,
      caller,
      firstLossVault,
      liquidityAsset,
      otherAccount,
      loanFactory,
      loan,
      serviceConfiguration,
      mockILoanOne,
      mockILoanTwo
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

  describe("calculateExpectedInterest()", async () => {
    async function setupMockILoan(mock: any, start: number) {
      await mock.setPayment(1000);
      await mock.setPaymentPeriod(30); // days
      await mock.setPaymentDueDate(start + ONE_MONTH_SECONDS);
      await mock.setPaymentsRemaining(3);
    }

    it("returns 0 interest at beginning of payment term", async () => {
      const { poolLibWrapper, loan } = await loadFixture(deployFixture);

      // set mock
      await poolLibWrapper.setMockActiveLoans([loan.address]);

      expect(
        await poolLibWrapper.calculateExpectedInterestFromMocks()
      ).to.equal(0);
    });

    it("returns half of payment midway through 1st payment interval", async () => {
      const { poolLibWrapper, mockILoanOne } = await loadFixture(deployFixture);

      const start = await time.latest();
      // setup mock
      await setupMockILoan(mockILoanOne, start);

      // set mock on the pool lib
      await poolLibWrapper.setMockActiveLoans([mockILoanOne.address]);

      // Fast-forward to midway through first payment
      await time.increaseTo(start + ONE_MONTH_SECONDS / 2);

      expect(
        await poolLibWrapper.calculateExpectedInterestFromMocks()
      ).to.equal(1000 / 2);
    });

    it("returns half of payment, if midway through 2nd period and first was paid on time", async () => {
      const { poolLibWrapper, mockILoanOne } = await loadFixture(deployFixture);

      const start = await time.latest();

      // setup mock
      await setupMockILoan(mockILoanOne, start);

      // set mock on the pool lib
      await poolLibWrapper.setMockActiveLoans([mockILoanOne.address]);

      // Fast-forward to midway through 2nd payment
      await time.increaseTo(start + (ONE_MONTH_SECONDS * 3) / 2);
      await mockILoanOne.setPaymentsRemaining(2); // simulate payment
      await mockILoanOne.setPaymentDueDate(
        (
          await mockILoanOne.paymentDueDate()
        ).add((await mockILoanOne.paymentPeriod()).mul(86400))
      ); // Bump payment due date

      expect(
        await poolLibWrapper.calculateExpectedInterestFromMocks()
      ).to.equal(1000 / 2);
    });

    it("returns whole first payment + a portion of the 2nd, if late on the first payment", async () => {
      const { poolLibWrapper, mockILoanOne } = await loadFixture(deployFixture);

      const start = await time.latest();
      // setup mock
      await setupMockILoan(mockILoanOne, start);

      // set mock on the pool lib
      await poolLibWrapper.setMockActiveLoans([mockILoanOne.address]);

      // Fast-forward to midway through SECOND payment
      await time.increaseTo(start + (ONE_MONTH_SECONDS * 3) / 2);

      expect(
        await poolLibWrapper.calculateExpectedInterestFromMocks()
      ).to.equal((1000 * 3) / 2);
    });

    it("returns sum of all payments if late on all payments", async () => {
      const { poolLibWrapper, mockILoanOne } = await loadFixture(deployFixture);

      const start = await time.latest();
      // setup mock
      await setupMockILoan(mockILoanOne, start);

      // set mock on the pool lib
      await poolLibWrapper.setMockActiveLoans([mockILoanOne.address]);

      // Fast-forward to midway through first payment
      // bump the time further past to ensure nothing extra accrues
      await time.increaseTo(start + ONE_MONTH_SECONDS * 4);

      expect(
        await poolLibWrapper.calculateExpectedInterestFromMocks()
      ).to.equal(1000 * 3);
    });

    it("returns the sum of interest accross multiple loans", async () => {
      const { poolLibWrapper, mockILoanOne, mockILoanTwo } = await loadFixture(
        deployFixture
      );

      const start = await time.latest();

      // setup mock
      await setupMockILoan(mockILoanOne, start);
      await setupMockILoan(mockILoanTwo, start);

      // set mock on the pool lib
      await poolLibWrapper.setMockActiveLoans([
        mockILoanOne.address,
        mockILoanTwo.address
      ]);

      // Fast-forward to midway through first payment
      await time.increaseTo(start + (ONE_MONTH_SECONDS * 1) / 2);

      expect(
        await poolLibWrapper.calculateExpectedInterestFromMocks()
      ).to.equal(500 * 2);
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

  describe("calculateCurrentWithdrawPeriod()", () => {
    it("returns 0 if the pool has not yet been activated", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const activatedAt = 0;
      const withdrawWindowDuration = 100;

      expect(
        await poolLibWrapper.calculateCurrentWithdrawPeriod(
          currentTimestamp,
          activatedAt,
          withdrawWindowDuration
        )
      ).to.equal(0);
    });

    it("returns 0 if the pool is activated, but in the first period", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const activatedAt = currentTimestamp - 10;
      const withdrawWindowDuration = 100;

      expect(
        await poolLibWrapper.calculateCurrentWithdrawPeriod(
          currentTimestamp,
          activatedAt,
          withdrawWindowDuration
        )
      ).to.equal(0);
    });

    it("returns 1 if in the first withdrawable period", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const activatedAt = currentTimestamp - 110;
      const withdrawWindowDuration = 100;

      expect(
        await poolLibWrapper.calculateCurrentWithdrawPeriod(
          currentTimestamp,
          activatedAt,
          withdrawWindowDuration
        )
      ).to.equal(1);
    });
  });

  describe("calculateWithdrawStateForRequest", () => {
    it("increments the requested shares of the lender", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const withdrawState = buildWithdrawState();

      expect(
        await poolLibWrapper.calculateWithdrawStateForRequest(
          withdrawState,
          0,
          22
        )
      ).to.deep.equal(
        Object.values(
          buildWithdrawState({
            requestedShares: 22,
            latestRequestPeriod: 1
          })
        )
      );
    });

    it("rolls over requested shares to be eligible if we are in a new period", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const withdrawState = buildWithdrawState({
        requestedShares: 50,
        latestRequestPeriod: 1
      });

      expect(
        await poolLibWrapper.calculateWithdrawStateForRequest(
          withdrawState,
          1,
          33
        )
      ).to.deep.equal(
        Object.values(
          buildWithdrawState({
            requestedShares: 33,
            eligibleShares: 50,
            latestRequestPeriod: 2
          })
        )
      );
    });
  });

  describe("calculateWithdrawStateForCancellation", () => {
    it("subtracts the requested shares of the lender, followed by eligible shares", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const withdrawState = buildWithdrawState({
        requestedShares: 10,
        eligibleShares: 20
      });

      expect(
        await poolLibWrapper.calculateWithdrawStateForCancellation(
          withdrawState,
          0,
          22
        )
      ).to.deep.equal(
        Object.values(
          buildWithdrawState({
            requestedShares: 0,
            eligibleShares: 8
          })
        )
      );
    });

    it("returns an error if not enough shares available to cancel", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const withdrawState = buildWithdrawState({
        requestedShares: 20,
        latestRequestPeriod: 1
      });

      await expect(
        poolLibWrapper.calculateWithdrawStateForCancellation(
          withdrawState,
          1,
          33
        )
      ).to.be.revertedWith("Pool: Invalid cancelled shares");
    });
  });

  describe("calculateRequestFee()", () => {
    it("calculates the fee for a request", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const shares = 500;
      const bps = 127; // 1.27%

      expect(await poolLibWrapper.calculateRequestFee(shares, bps)).to.equal(7);
    });

    it("rounds the fee up", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const shares = 101;
      const bps = 900; // 9%

      expect(await poolLibWrapper.calculateRequestFee(shares, bps)).to.equal(
        10
      ); // 9.09 rounded up
    });
  });

  describe("calculateCancellationFee()", () => {
    it("calculates the fee for a cancellation", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const shares = 500;
      const bps = 127; // 1.27%

      expect(
        await poolLibWrapper.calculateCancellationFee(shares, bps)
      ).to.equal(7);
    });

    it("rounds the fee up", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const shares = 101;
      const bps = 900; // 9%

      expect(
        await poolLibWrapper.calculateCancellationFee(shares, bps)
      ).to.equal(10); // 9.09 rounded up
    });
  });

  describe("calculateMaxRedeemRequest()", () => {
    it("returns the number of shares the owner has not yet requested if no fees", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const balance = 100;
      const fees = 0;
      const withdrawState = buildWithdrawState({
        requestedShares: 50,
        eligibleShares: 22,
        latestRequestPeriod: 2
      });

      expect(
        await poolLibWrapper.calculateMaxRedeemRequest(
          withdrawState,
          balance,
          fees
        )
      ).to.equal(28);
    });

    it("returns the number of shares minus fees", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const balance = 100;
      const fees = 1200; // 12%
      const withdrawState = buildWithdrawState({
        requestedShares: 50,
        eligibleShares: 20,
        latestRequestPeriod: 2
      });

      expect(
        await poolLibWrapper.calculateMaxRedeemRequest(
          withdrawState,
          balance,
          fees
        )
      ).to.equal(26);
    });
  });

  describe("calculateMaxCancellation()", () => {
    it("returns the number of shares the owner can cancel from a request", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const fees = 0;
      const withdrawState = buildWithdrawState({
        requestedShares: 50,
        eligibleShares: 22,
        redeemableShares: 28,
        latestRequestPeriod: 2
      });

      expect(
        await poolLibWrapper.calculateMaxCancellation(withdrawState, fees)
      ).to.equal(72);
    });

    it("returns the number of shares minus fees", async () => {
      const { poolLibWrapper } = await loadFixture(deployFixture);

      const fees = 1200; // 12%
      const withdrawState = buildWithdrawState({
        requestedShares: 50,
        eligibleShares: 22,
        redeemableShares: 28,
        latestRequestPeriod: 2
      });

      expect(
        await poolLibWrapper.calculateMaxCancellation(withdrawState, fees)
      ).to.equal(63);
    });
  });
});
