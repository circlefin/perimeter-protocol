import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DEFAULT_POOL_SETTINGS } from "./support/pool";
import { deployMockERC20 } from "./support/erc20";

describe("Loan", () => {
  const SEVEN_DAYS = 6 * 60 * 60 * 24;
  const THIRTY_DAYS = 30 * 60 * 60 * 24;

  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, poolManager, borrower, lender, other] =
      await ethers.getSigners();

    // deploy mock liquidity
    const { mockERC20 } = await deployMockERC20();
    const liquidityAsset = mockERC20;

    // Deploy the Service Configuration contract
    const ServiceConfiguration = await ethers.getContractFactory(
      "ServiceConfiguration",
      operator
    );
    const serviceConfiguration = await ServiceConfiguration.deploy();
    await serviceConfiguration.deployed();

    await serviceConfiguration.setLiquidityAsset(liquidityAsset.address, true);

    const PoolLib = await ethers.getContractFactory("PoolLib");
    const poolLib = await PoolLib.deploy();

    const LoanLib = await ethers.getContractFactory("LoanLib");
    const loanLib = await LoanLib.deploy();

    const PoolFactory = await ethers.getContractFactory("PoolFactory", {
      libraries: {
        PoolLib: poolLib.address
      }
    });
    const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
    await poolFactory.deployed();

    const LoanFactory = await ethers.getContractFactory("LoanFactory", {
      libraries: {
        LoanLib: loanLib.address
      }
    });
    const loanFactory = await LoanFactory.deploy(serviceConfiguration.address);
    await loanFactory.deployed();

    await serviceConfiguration.setLoanFactory(loanFactory.address, true);

    // Create a pool
    const tx1 = await poolFactory
      .connect(poolManager)
      .createPool(
        liquidityAsset.address,
        DEFAULT_POOL_SETTINGS.maxCapacity,
        DEFAULT_POOL_SETTINGS.endDate,
        DEFAULT_POOL_SETTINGS.withdrawalFee,
        DEFAULT_POOL_SETTINGS.withdrawRequestPeriodDuration
      );
    const tx1Receipt = await tx1.wait();

    // Extract its address from the PoolCreated event
    const poolCreatedEvent = findEventByName(tx1Receipt, "PoolCreated");
    const poolAddress = poolCreatedEvent?.args?.[0];
    const Pool = await ethers.getContractFactory("Pool", {
      libraries: {
        PoolLib: poolLib.address
      }
    });
    const pool = Pool.attach(poolAddress);

    const { firstLossInitialMinimum } = await pool.settings();

    await pool
      .connect(poolManager)
      .approve(pool.address, firstLossInitialMinimum);

    await pool
      .connect(poolManager)
      .depositFirstLoss(firstLossInitialMinimum, poolManager.address);

    const depositAmount = 1_000_000;
    await liquidityAsset.mint(lender.address, 10_000_000);
    await liquidityAsset.connect(lender).approve(pool.address, depositAmount);
    await pool.connect(lender).deposit(depositAmount, lender.address);

    // Create the Loan
    const tx2 = await loanFactory.createLoan(
      borrower.address,
      poolAddress,
      180,
      30,
      0,
      500,
      liquidityAsset.address,
      500_000,
      Math.floor(Date.now() / 1000) + SEVEN_DAYS
    );
    const tx2Receipt = await tx2.wait();

    const loanCreatedEvent = findEventByName(tx2Receipt, "LoanCreated");
    const loanAddress = loanCreatedEvent?.args?.[0];
    const Loan = await ethers.getContractFactory("Loan", {
      libraries: {
        LoanLib: loanLib.address
      }
    });
    const loan = Loan.attach(loanAddress);

    const CollateralAsset = await ethers.getContractFactory("MockERC20");
    const collateralAsset = await CollateralAsset.deploy("Test Coin", "TC");
    await collateralAsset.deployed();

    const NftAsset = await ethers.getContractFactory("MockERC721");
    const nftAsset = await NftAsset.deploy(
      "Valyria NFT",
      "VAL",
      "http://example.com/"
    );
    await nftAsset.deployed();

    await collateralAsset.mint(borrower.address, 1_000_000);

    return {
      pool,
      loan,
      loanFactory,
      operator,
      poolManager,
      borrower,
      collateralAsset,
      liquidityAsset,
      nftAsset,
      other,
      serviceConfiguration
    };
  }

  describe("after initialization", () => {
    it("is initialized!", async () => {
      const { loan, pool, borrower, loanFactory } = await loadFixture(
        deployFixture
      );
      expect(await loan.state()).to.equal(0);
      expect(await loan.borrower()).to.equal(borrower.address);
      expect(await loan.pool()).to.equal(pool.address);
      expect(await loan.duration()).to.equal(180); // 6 month duration
      expect(await loan.paymentPeriod()).to.equal(30); // 30 day payments
      expect(await loan.loanType()).to.equal(0); // fixed
      expect(await loan.apr()).to.equal(500); // apr 5.00%
      expect(await loan.principal()).to.equal(500_000); // $500,000
      expect(await loan.factory()).to.equal(loanFactory.address);
    });
  });

  describe("cancelRequested", () => {
    it("transitions Loan to canceled state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);
      expect(await loan.state()).to.equal(0);

      // Cancel
      await expect(loan.cancelRequested()).not.to.be.reverted;
      expect(await loan.state()).to.equal(2);
    });

    it("reverts if not called by the borrower", async () => {
      const { loan, other } = await loadFixture(deployFixture);

      await expect(loan.connect(other).cancelRequested()).to.be.revertedWith(
        "Loan: caller is not borrower"
      );
    });
  });

  describe("cancelCollateralized", () => {
    it("transitions Loan to canceled state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower, collateralAsset } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);
      expect(await loan.state()).to.equal(0);

      // Post collateral
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      const tx = loan.postFungibleCollateral(collateralAsset.address, 100);
      await expect(tx).not.to.be.reverted;
      await expect(tx).to.changeTokenBalance(
        collateralAsset,
        borrower.address,
        -100
      );
      await expect(tx).to.changeTokenBalance(
        collateralAsset,
        await loan._collateralVault(),
        +100
      );
      expect(await loan.state()).to.equal(1);

      // Advance time to drop dead timestamp
      await time.increaseTo(await loan.dropDeadTimestamp());

      // Cancel
      const tx2 = loan.cancelCollateralized();
      await expect(tx2).not.to.be.reverted;
      await expect(tx2).to.changeTokenBalance(
        collateralAsset,
        borrower.address,
        +100
      );
      await expect(tx2).to.changeTokenBalance(
        collateralAsset,
        await loan._collateralVault(),
        -100
      );
      await expect(tx2)
        .to.emit(loan, "WithdrewCollateral")
        .withArgs(collateralAsset.address, 100);

      const c20 = await loan.fungibleCollateral();
      expect(c20.length).to.equal(0);
      const c721 = await loan.nonFungibleCollateral();
      expect(c721.length).to.equal(0);
      expect(await loan.state()).to.equal(2);
    });

    it("reverts if the drop dead date hasn't been hit", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower, collateralAsset } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);
      expect(await loan.state()).to.equal(0);

      // Post collateral
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan.postFungibleCollateral(collateralAsset.address, 100);
      const tx2 = loan.cancelCollateralized();
      await expect(tx2).to.be.revertedWith("Loan: Drop dead date not met");
    });

    it("reverts if not called by the borrower", async () => {
      const { loan, other } = await loadFixture(deployFixture);

      await expect(
        loan.connect(other).cancelCollateralized()
      ).to.be.revertedWith("Loan: caller is not borrower");
    });
  });

  describe("postFungibleCollateral", () => {
    it("transitions Loan to collateralized state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower, collateralAsset } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);
      expect(await loan.state()).to.equal(0);

      // Post collateral
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await expect(loan.postFungibleCollateral(collateralAsset.address, 100))
        .not.to.be.reverted;
      expect(await loan.state()).to.equal(1);

      // Record the collateral
      let c = await loan.fungibleCollateral();
      expect(c[0]).to.equal(collateralAsset.address);
      expect(c.length).to.equal(1);

      // Collateral will be in the vault
      const collateralVault = await loan._collateralVault();
      expect(await collateralAsset.balanceOf(collateralVault)).to.equal(100);

      // Post collateral again
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await expect(loan.postFungibleCollateral(collateralAsset.address, 100))
        .not.to.be.reverted;

      // Recorded collateral will be updated (not two records)
      c = await loan.fungibleCollateral();
      expect(c[0]).to.equal(collateralAsset.address);
      expect(c.length).to.equal(1);

      // Collateral will be in the vault
      expect(await collateralAsset.balanceOf(collateralVault)).to.equal(200);
    });

    it("emits PostedCollateral event", async () => {
      const fixture = await loadFixture(deployFixture);
      const { borrower, loan, collateralAsset } = fixture;

      // Post collateral
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      expect(
        await loan
          .connect(borrower)
          .postFungibleCollateral(collateralAsset.address, 100)
      )
        .to.emit(loan, "PostedCollateral")
        .withArgs(collateralAsset.address, 100);
      expect(await loan.state()).to.equal(1);
    });

    it("reverts if not called by the borrower", async () => {
      const { loan, collateralAsset, other } = await loadFixture(deployFixture);

      await collateralAsset.connect(other).approve(loan.address, 100);
      await expect(
        loan.connect(other).postFungibleCollateral(collateralAsset.address, 100)
      ).to.be.revertedWith("Loan: caller is not borrower");
    });
  });

  describe("postNonFungibleCollateral", () => {
    it("transitions Loan to collateralized state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower, nftAsset } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);
      expect(await loan.state()).to.equal(0);

      await nftAsset.mint(borrower.address);
      const tokenId = await nftAsset.tokenOfOwnerByIndex(borrower.address, 0);
      await nftAsset.connect(borrower).approve(loan.address, tokenId);

      // Collateral vault will start with no asset
      let balanceOf = await nftAsset.balanceOf(await loan._collateralVault());
      expect(balanceOf).to.equal(0);

      // Post collateral
      await expect(loan.postNonFungibleCollateral(nftAsset.address, tokenId))
        .not.to.be.reverted;
      expect(await loan.state()).to.equal(1);

      const c = await loan.nonFungibleCollateral();
      expect(c[0][0]).to.equal(nftAsset.address);
      expect(c[0][1]).to.equal(tokenId);

      balanceOf = await nftAsset.balanceOf(await loan._collateralVault());
      expect(balanceOf).to.equal(1);
    });

    it("reverts if not called by the borrower", async () => {
      const { loan, other, nftAsset } = await loadFixture(deployFixture);

      await expect(
        loan.connect(other).postNonFungibleCollateral(nftAsset.address, 0)
      ).to.be.revertedWith("Loan: caller is not borrower");
    });
  });

  describe("fund", () => {
    it("transitions Loan to Funded state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower, collateralAsset, liquidityAsset, pool, poolManager } =
        fixture;

      // Connect as borrower
      loan = loan.connect(borrower);

      expect(await loan.state()).to.equal(0);
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await expect(loan.postFungibleCollateral(collateralAsset.address, 100))
        .not.to.be.reverted;
      expect(await loan.state()).to.equal(1);
      const fundTx = pool.connect(poolManager).fundLoan(loan.address);
      await expect(fundTx).not.to.be.reverted;
      await expect(fundTx)
        .to.emit(loan, "LoanFunded")
        .withArgs(loan.liquidityAsset, 500_000);
      await expect(fundTx).to.changeTokenBalance(
        liquidityAsset,
        await loan.fundingVault(),
        500_000
      );
      await expect(fundTx).to.changeTokenBalance(
        liquidityAsset,
        pool,
        -500_000
      );

      expect(await loan.state()).to.equal(4);
    });

    it("reverts if not in the collateralized state", async () => {
      const { pool, poolManager, loan } = await loadFixture(deployFixture);

      expect(await loan.state()).to.equal(0);
      await expect(
        pool.connect(poolManager).fundLoan(loan.address)
      ).to.be.revertedWith("Loan: FunctionInvalidAtThisILoanLifeCycleState");
      expect(await loan.state()).to.equal(0);
    });

    it("reverts if not called by the pool", async () => {
      const { loan, borrower, collateralAsset, other } = await loadFixture(
        deployFixture
      );

      expect(await loan.state()).to.equal(0);
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await expect(
        loan
          .connect(borrower)
          .postFungibleCollateral(collateralAsset.address, 100)
      ).not.to.be.reverted;
      expect(await loan.state()).to.equal(1);

      await expect(loan.connect(other).fund()).to.be.revertedWith(
        "Loan: caller is not pool"
      );
    });
  });

  describe("drawdown", () => {
    it("transfers funds to the borrower", async () => {
      const fixture = await loadFixture(deployFixture);
      const {
        borrower,
        collateralAsset,
        liquidityAsset,
        loan,
        pool,
        poolManager
      } = fixture;

      // Setup and fund loan
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await expect(
        loan
          .connect(borrower)
          .postFungibleCollateral(collateralAsset.address, 100)
      ).not.to.be.reverted;
      await expect(pool.connect(poolManager).fundLoan(loan.address)).not.to.be
        .reverted;
      expect(await loan.state()).to.equal(4);

      // Draw down the funds
      const drawDownTx = loan.connect(borrower).drawdown();
      await expect(drawDownTx).not.to.be.reverted;
      await expect(drawDownTx).to.changeTokenBalance(
        liquidityAsset,
        borrower.address,
        500_000
      );
      await expect(drawDownTx).to.changeTokenBalance(
        liquidityAsset,
        await loan.fundingVault(),
        -500_000
      );
      await expect(drawDownTx)
        .to.emit(loan, "LoanDrawnDown")
        .withArgs(loan.liquidityAsset, 500_000);

      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      expect(await loan.paymentDueDate()).to.equal(now + THIRTY_DAYS);

      // Try again
      const drawDownTx2 = loan.connect(borrower).drawdown();
      await expect(drawDownTx2).not.to.be.reverted;
      await expect(drawDownTx2).to.changeTokenBalance(
        liquidityAsset,
        borrower.address,
        0
      );
    });
  });

  describe("markDefaulted", () => {
    it("reverts if not called by pool", async () => {
      const { loan, other } = await loadFixture(deployFixture);

      await expect(loan.connect(other).markDefaulted()).to.be.revertedWith(
        "Loan: caller is not pool"
      );
    });

    it("transitions state only if defaulted while in a Funded state", async () => {
      const fixture = await loadFixture(deployFixture);
      const { borrower, collateralAsset, poolManager } = fixture;
      const loan = fixture.loan.connect(borrower);
      const pool = fixture.pool.connect(poolManager);

      // Check Loan is in requested state; defaults should revert
      expect(await loan.state()).to.equal(0);
      await expect(pool.defaultLoan(loan.address)).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );

      // Loan is collateralized; defaults should still revert
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan.postFungibleCollateral(collateralAsset.address, 100);
      expect(await loan.state()).to.equal(1);
      await expect(pool.defaultLoan(loan.address)).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );

      // Loan is funded
      await pool.fundLoan(loan.address);
      expect(await loan.state()).to.equal(4);

      // Default should proceed
      await expect(pool.defaultLoan(loan.address)).to.emit(
        loan,
        "LifeCycleStateTransition"
      );
      expect(await loan.state()).to.equal(3);
    });
  });

  describe("payments", () => {
    it("calculates payments correctly", async () => {
      const fixture = await loadFixture(deployFixture);
      const { loan } = fixture;

      expect(await loan.paymentsRemaining()).to.equal(6);
      expect(await loan.payment()).to.equal(2083);
      expect(await loan.paymentDueDate()).to.equal(0);
    });

    it("can complete the next payment", async () => {
      const fixture = await loadFixture(deployFixture);
      const {
        borrower,
        collateralAsset,
        liquidityAsset,
        loan,
        pool,
        poolManager
      } = fixture;

      // Setup
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan
        .connect(borrower)
        .postFungibleCollateral(collateralAsset.address, 100);
      await pool.connect(poolManager).fundLoan(loan.address);
      await loan.connect(borrower).drawdown();

      // Make payment
      const firstLoss = await pool.firstLossVault();
      const dueDate = await loan.paymentDueDate();
      expect(await loan.paymentsRemaining()).to.equal(6);
      await liquidityAsset.connect(borrower).approve(loan.address, 2083);
      const tx = loan.connect(borrower).completeNextPayment();
      await expect(tx).to.not.be.reverted;
      await expect(tx).to.changeTokenBalance(liquidityAsset, borrower, -2083);
      await expect(tx).to.changeTokenBalance(liquidityAsset, pool, 1979);
      await expect(tx).to.changeTokenBalance(liquidityAsset, firstLoss, 104);
      expect(await loan.paymentsRemaining()).to.equal(5);
      const newDueDate = await loan.paymentDueDate();
      expect(newDueDate).to.equal(dueDate.add(THIRTY_DAYS));
    });

    it("can payoff the entire loan at once", async () => {
      const fixture = await loadFixture(deployFixture);
      const {
        borrower,
        collateralAsset,
        liquidityAsset,
        loan,
        pool,
        poolManager
      } = fixture;

      // Setup
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan
        .connect(borrower)
        .postFungibleCollateral(collateralAsset.address, 100);
      await pool.connect(poolManager).fundLoan(loan.address);
      await loan.connect(borrower).drawdown();

      // Mint additional tokens to cover the interest payments
      await liquidityAsset.mint(borrower.address, 12498);

      // Make payment
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, 12498 + 500_000);
      const tx = loan.connect(borrower).completeFullPayment();
      await expect(tx).to.not.be.reverted;
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        borrower,
        -12498 - 500_000
      );
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        pool,
        12498 + 500_000 - 624
      );
      const firstLoss = await pool.firstLossVault();
      await expect(tx).to.changeTokenBalance(liquidityAsset, firstLoss, 624);

      expect(await loan.paymentsRemaining()).to.equal(0);
      expect(await loan.state()).to.equal(5);
    });

    it("can make payments and pay off the loan", async () => {
      const fixture = await loadFixture(deployFixture);
      const {
        borrower,
        collateralAsset,
        liquidityAsset,
        loan,
        pool,
        poolManager
      } = fixture;

      // Setup
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan
        .connect(borrower)
        .postFungibleCollateral(collateralAsset.address, 100);
      await pool.connect(poolManager).fundLoan(loan.address);
      await loan.connect(borrower).drawdown();

      // Mint additional tokens to cover the interest payments
      await liquidityAsset.mint(borrower.address, 12498);

      // Make payment
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, 12498 + 500_000);
      await loan.connect(borrower).completeNextPayment();
      await loan.connect(borrower).completeNextPayment();
      await loan.connect(borrower).completeNextPayment();
      await loan.connect(borrower).completeNextPayment();
      await loan.connect(borrower).completeNextPayment();
      await loan.connect(borrower).completeNextPayment();
      expect(await loan.state()).to.equal(4);
      await loan.connect(borrower).completeFullPayment();
      expect(await loan.paymentsRemaining()).to.equal(0);
      expect(await loan.state()).to.equal(5);
    });

    it("can collect pool fees from the next payment", async () => {
      const fixture = await loadFixture(deployFixture);
      const {
        borrower,
        collateralAsset,
        liquidityAsset,
        loan,
        pool,
        poolManager,
        serviceConfiguration
      } = fixture;

      // Setup
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan
        .connect(borrower)
        .postFungibleCollateral(collateralAsset.address, 100);
      await pool.connect(poolManager).fundLoan(loan.address);
      await loan.connect(borrower).drawdown();

      // Make payment
      const firstLoss = await pool.firstLossVault();
      const feeVault = await pool.feeVault();
      await serviceConfiguration.setPoolFeePercentOfInterest(100);
      const dueDate = await loan.paymentDueDate();
      expect(await loan.paymentsRemaining()).to.equal(6);
      await liquidityAsset.connect(borrower).approve(loan.address, 2083);
      const tx = loan.connect(borrower).completeNextPayment();
      await expect(tx).to.not.be.reverted;
      await expect(tx).to.changeTokenBalance(liquidityAsset, borrower, -2083);
      await expect(tx).to.changeTokenBalance(liquidityAsset, pool, 1959);
      await expect(tx).to.changeTokenBalance(liquidityAsset, feeVault, 20);
      await expect(tx).to.changeTokenBalance(liquidityAsset, firstLoss, 104);
      expect(await loan.paymentsRemaining()).to.equal(5);
      const newDueDate = await loan.paymentDueDate();
      expect(newDueDate).to.equal(dueDate.add(THIRTY_DAYS));
    });
  });

  const findEventByName = (receipt, name) => {
    return receipt.events?.find((event) => event.event == name);
  };
});
