import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool, activatePool } from "../../support/pool";
import { collateralizeLoan, deployLoan, fundLoan } from "../../support/loan";
import { deployMockERC20 } from "../../support/erc20";

describe("Business Scenario 1", () => {
  const INPUTS = {
    lenderADepositAmount: 500_000_000_000, // $500k in USDC
    lenderBDepositAmount: 200_000_000_000, // $200k in USDC
    pool: {
      maxCapacity: 10_000_000_000_000, // $10M in USDC  10_000_000_000_000
      requestFeeBps: 50, // 0.5%
      withdrawGateBps: 10_000, // 100%
      requestCancellationFeeBps: 0,
      firstLossInitialMinimum: 0,
      withdrawRequestPeriodDuration: 14 * 24 * 60 * 60, // 14 days
      fixedFee: 0,
      fixedFeeInterval: 0,
      poolFeePercentOfInterest: 0
    },
    loanOne: {
      duration: 7,
      paymentPeriod: 7,
      loanType: 0,
      apr: 1500, // 15%,
      principal: 500_000_000_000,
      dropDeadDateDuration: 0,
      latePaymentFee: 0,
      latePayment: 0,
      originationBps: 100
    },
    loanTwo: {
      duration: 7,
      paymentPeriod: 7,
      loanType: 0,
      apr: 2000, // 20%,
      principal: 100_000_000_000, // $100k USDC
      dropDeadDateDuration: 0,
      latePaymentFee: 0,
      latePayment: 0,
      originationBps: 100
    },
    loanOnePayment: 1_556_330_000, //  $1,458.33 in interest + 97.22 in origination, + rounding
    loanTwoPayment: 408_334_000 // $388.89 in interest + 19.44 in origination, + rounding
  };

  async function advanceToDay(startTime: number, numberDays: number) {
    await time.increaseTo(startTime + numberDays * 3600 * 24);
  }

  async function loadFixtures() {
    const [operator, poolAdmin, lenderA, lenderB, borrowerOne, borrowerTwo] =
      await ethers.getSigners();

    const startTime = await time.latest();
    const endTime = startTime + 5_184_000; // 60 days.
    const poolSettings = {
      endDate: endTime, // Jan 1, 2050
      ...INPUTS.pool
    };
    const { mockERC20: mockUSDC } = await deployMockERC20(
      "Mock USDC",
      "MUSDC",
      6
    );
    const { pool, serviceConfiguration } = await deployPool({
      operator,
      poolAdmin: poolAdmin,
      settings: poolSettings,
      liquidityAsset: mockUSDC
    });

    // Confirm FL fee is set to 5%
    expect(await serviceConfiguration.firstLossFeeBps()).to.equal(500);

    // activate pool
    await activatePool(pool, poolAdmin, mockUSDC);

    // Mint for lenders
    await mockUSDC.mint(lenderA.address, INPUTS.lenderADepositAmount);
    await mockUSDC.mint(lenderB.address, INPUTS.lenderBDepositAmount);

    // Lender allowance for pool
    await mockUSDC
      .connect(lenderA)
      .approve(pool.address, INPUTS.lenderADepositAmount);
    await mockUSDC
      .connect(lenderB)
      .approve(pool.address, INPUTS.lenderBDepositAmount);

    // Create loanOne
    const { loan: loanOne } = await deployLoan(
      pool.address,
      borrowerOne.address,
      mockUSDC.address,
      serviceConfiguration,
      INPUTS.loanOne
    );
    // mint USDC for borrower to pay down loanOne
    await mockUSDC.mint(borrowerOne.address, INPUTS.loanOnePayment);

    // Create loanTwo
    const { loan: loanTwo } = await deployLoan(
      pool.address,
      borrowerTwo.address,
      mockUSDC.address,
      serviceConfiguration,
      INPUTS.loanTwo
    );
    // mint USDC for borrower to pay down loanTwo
    await mockUSDC.mint(borrowerTwo.address, INPUTS.loanTwoPayment);

    await collateralizeLoan(loanOne, borrowerOne, mockUSDC, 0);
    await collateralizeLoan(loanTwo, borrowerTwo, mockUSDC, 0);

    return {
      startTime,
      pool,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      borrowerOne,
      borrowerTwo,
      loanOne,
      loanTwo
    };
  }

  it("runs simulation", async () => {
    const {
      startTime,
      pool,
      lenderA,
      lenderB,
      mockUSDC,
      poolAdmin,
      borrowerOne,
      borrowerTwo,
      loanOne,
      loanTwo
    } = await loadFixture(loadFixtures);

    // Initialization checks
    // check that FL is zero
    expect(await pool.firstLoss()).to.equal(0);
    // Check that PM has no USDC balance
    expect(await mockUSDC.balanceOf(poolAdmin.address)).to.equal(0);

    // +3 days, lenderA deposits
    await advanceToDay(startTime, 3);
    await pool
      .connect(lenderA)
      .deposit(INPUTS.lenderADepositAmount, lenderA.address);

    // sanity-check lenderA is cleared out
    expect(await mockUSDC.balanceOf(lenderA.address)).to.equal(0);
    // check pool tokens minted
    expect(await pool.balanceOf(lenderA.address)).to.equal(
      INPUTS.lenderADepositAmount
    );

    // +4 days, loanOne is funded
    await advanceToDay(startTime, 4);
    await fundLoan(loanOne, pool, poolAdmin);
    await loanOne.connect(borrowerOne).drawdown(INPUTS.loanOne.principal);

    // +8 days, lenderB deposits
    await advanceToDay(startTime, 8);
    await pool
      .connect(lenderB)
      .deposit(INPUTS.lenderBDepositAmount, lenderB.address);

    // sanity-check lenderB is cleared out
    expect(await mockUSDC.balanceOf(lenderB.address)).to.equal(0);
    // check pool tokens minted
    expect(await pool.balanceOf(lenderB.address)).to.equal(199_667_222_259);

    // +9 days, loanTwo funded
    await advanceToDay(startTime, 9);
    await fundLoan(loanTwo, pool, poolAdmin);
    await loanTwo.connect(borrowerTwo).drawdown(INPUTS.loanTwo.principal);

    // +11 days, loan one matures
    await advanceToDay(startTime, 11);
    await mockUSDC
      .connect(borrowerOne)
      .approve(
        loanOne.address,
        INPUTS.loanOnePayment + INPUTS.loanOne.principal
      );
    await loanOne.connect(borrowerOne).completeFullPayment();

    // +14 days, request full withdrawal at start of 2nd window
    await advanceToDay(startTime, 14);
    await pool
      .connect(lenderA)
      .requestRedeem(await pool.maxRedeemRequest(lenderA.address));
    await pool
      .connect(lenderB)
      .requestRedeem(await pool.maxRedeemRequest(lenderB.address));

    // +16 days, loan two matures
    await advanceToDay(startTime, 16);
    await mockUSDC
      .connect(borrowerTwo)
      .approve(
        loanTwo.address,
        INPUTS.loanTwoPayment + INPUTS.loanTwo.principal
      );
    await loanTwo.connect(borrowerTwo).completeFullPayment();

    // Request window is 14 days, so fast forward to +28 days to claim in next window
    await advanceToDay(startTime, 28);
    await pool.crank();
    await pool
      .connect(lenderA)
      .redeem(
        await pool.maxRedeem(lenderA.address),
        lenderA.address,
        lenderA.address
      );
    await pool
      .connect(lenderB)
      .redeem(
        await pool.maxRedeem(lenderB.address),
        lenderB.address,
        lenderB.address
      );

    // Pool should only have USDC and pool token dust
    expect(await mockUSDC.balanceOf(pool.address)).to.be.lessThan(10);
    expect(await pool.totalSupply()).to.be.lessThan(10);

    // Check that FL was delivered
    expect(await pool.firstLoss()).to.equal(92361110);

    // Check that origination fees were paid to PM
    expect(await mockUSDC.balanceOf(pool.feeVault())).to.equal(116666666);

    // Lender balances
    const lenderABalance = await mockUSDC.balanceOf(lenderA.address);
    const lenderBBalance = await mockUSDC.balanceOf(lenderB.address);
    const totalEarnings = lenderABalance
      .add(lenderBBalance)
      .sub(INPUTS.lenderADepositAmount)
      .sub(INPUTS.lenderBDepositAmount);

    expect(totalEarnings).to.equal(1_754_861_108);
    expect(lenderABalance).to.equal(501_491_879_842);
    expect(lenderBBalance).to.equal(200_262_981_266);
  });
});
