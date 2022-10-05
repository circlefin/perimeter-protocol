import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DEFAULT_POOL_SETTINGS } from "./support/pool";

describe("Loan", () => {
  const SEVEN_DAYS = 6 * 60 * 60 * 24;

  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, poolManager, borrower, lender, other] =
      await ethers.getSigners();

    const LiquidityAsset = await ethers.getContractFactory("MockERC20");
    const liquidityAsset = await LiquidityAsset.deploy("Test Coin", "TC");
    await liquidityAsset.deployed();

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
      operator,
      poolManager,
      borrower,
      collateralAsset,
      nftAsset,
      other
    };
  }

  describe("after initialization", () => {
    it("is initialized!", async () => {
      const { loan, pool, borrower } = await loadFixture(deployFixture);
      expect(await loan.state()).to.equal(0);
      expect(await loan.borrower()).to.equal(borrower.address);
      expect(await loan.pool()).to.equal(pool.address);

      expect(await loan.duration()).to.equal(180); // 6 month duration
      expect(await loan.paymentPeriod()).to.equal(30); // 30 day payments
      expect(await loan.loanType()).to.equal(0); // fixed
      expect(await loan.apr()).to.equal(500); // apr 5.00%
      expect(await loan.principal()).to.equal(500_000); // $500,000
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
      const { borrower, collateralAsset, pool, poolManager } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);

      expect(await loan.state()).to.equal(0);
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await expect(loan.postFungibleCollateral(collateralAsset.address, 100))
        .not.to.be.reverted;
      expect(await loan.state()).to.equal(1);
      await expect(pool.connect(poolManager).fundLoan(loan.address)).not.to.be
        .reverted;
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

  const findEventByName = (receipt, name) => {
    return receipt.events?.find((event) => event.event == name);
  };
});
