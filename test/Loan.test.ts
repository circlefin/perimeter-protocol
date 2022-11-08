import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DEFAULT_POOL_SETTINGS } from "./support/pool";
import {
  collateralizeLoan,
  collateralizeLoanNFT,
  DEFAULT_LOAN_SETTINGS,
  fundLoan,
  matureLoan
} from "./support/loan";
import { deployMockERC20 } from "./support/erc20";

describe("Loan", () => {
  const SEVEN_DAYS = 6 * 60 * 60 * 24;
  const THIRTY_DAYS = 30 * 60 * 60 * 24;

  async function deployFixture(
    poolSettings = DEFAULT_POOL_SETTINGS,
    loanSettings = Object.assign({}, DEFAULT_LOAN_SETTINGS, {
      principal: 500_000
    })
  ) {
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
      .createPool(liquidityAsset.address, poolSettings);
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

    await liquidityAsset.mint(poolManager.address, firstLossInitialMinimum);
    await liquidityAsset
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
      liquidityAsset.address,
      loanSettings
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
    const collateralAsset = await CollateralAsset.deploy("Test Coin", "TC", 18);
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

  async function deployFixturePoolFees() {
    const poolSettings = Object.assign({}, DEFAULT_POOL_SETTINGS, {
      poolFeePercentOfInterest: 100
    });
    return deployFixture(poolSettings);
  }

  async function deployFixtureOriginationFees() {
    return deployFixture(
      DEFAULT_POOL_SETTINGS,
      Object.assign({}, DEFAULT_LOAN_SETTINGS, {
        principal: 500_000,
        originationBps: 100
      })
    );
  }

  async function deployFixtureWithLateFees() {
    return deployFixture(
      DEFAULT_POOL_SETTINGS,
      Object.assign({}, DEFAULT_LOAN_SETTINGS, {
        principal: 500_000,
        latePayment: 1_000
      })
    );
  }

  async function deployFixtureOpenTerm() {
    return deployFixture(
      DEFAULT_POOL_SETTINGS,
      Object.assign({}, DEFAULT_LOAN_SETTINGS, {
        principal: 500_000,
        loanType: 1,
        originationBps: 100,
        poolFeePercentOfInterest: 100
      })
    );
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

  describe("cancelFunded", () => {
    it("reverts if not in Funded state", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      expect(await loan.state()).to.equal(0); // Requested
      await expect(loan.connect(borrower).cancelFunded()).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );

      await collateralizeLoan(loan, borrower, liquidityAsset);
      expect(await loan.state()).to.equal(1); // Collateralized
      await expect(loan.connect(borrower).cancelFunded()).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );

      await fundLoan(loan, pool, poolManager);
      await loan.connect(borrower).drawdown(await loan.principal());
      expect(await loan.state()).to.equal(6); // Active
      await expect(loan.connect(borrower).cancelFunded()).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );

      await pool.connect(poolManager).defaultLoan(loan.address);
      expect(await loan.state()).to.equal(3); // Defaulted
      await expect(loan.connect(borrower).cancelFunded()).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );
    });

    it("reverts if not called by borrower or PM", async () => {
      const { borrower, liquidityAsset, other, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await time.increaseTo(await loan.dropDeadTimestamp());

      await expect(loan.connect(other).cancelFunded()).to.be.revertedWith(
        "Loan: invalid caller"
      );
    });

    it("reverts if dropdead hasn't been met", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await expect(loan.connect(borrower).cancelFunded()).to.be.revertedWith(
        "Loan: Drop dead date not met"
      );

      // Advance past dropdead
      await time.increaseTo(await loan.dropDeadTimestamp());
      await expect(loan.connect(borrower).cancelFunded()).to.not.be.reverted;
    });

    it("returns principal to the pool ", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      const principal = await loan.principal();

      await time.increaseTo(await loan.dropDeadTimestamp());
      const txn = await loan.connect(borrower).cancelFunded();
      // Check balances
      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        pool.address,
        +principal
      );
      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        await loan.fundingVault(),
        -principal
      );
    });

    it("emits an event", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await time.increaseTo(await loan.dropDeadTimestamp());
      const principal = await loan.principal();
      await expect(loan.connect(borrower).cancelFunded())
        .to.emit(loan, "CanceledLoanPrincipalReturned")
        .withArgs(pool.address, principal);
    });

    it("can be called by PM", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await time.increaseTo(await loan.dropDeadTimestamp());
      await expect(loan.connect(poolManager).cancelFunded()).not.to.be.reverted;
    });

    it("can be called by borrower", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await time.increaseTo(await loan.dropDeadTimestamp());
      await expect(loan.connect(borrower).cancelFunded()).not.to.be.reverted;
    });

    it("transitions loan to canceled state", async () => {
      const { borrower, liquidityAsset, loan, pool, poolManager } =
        await loadFixture(deployFixture);

      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, pool, poolManager);
      await time.increaseTo(await loan.dropDeadTimestamp());
      expect(await loan.connect(borrower).cancelFunded());

      expect(await loan.state()).to.equal(2);
    });
  });

  describe("claimCollateral", () => {
    describe("Permissions", () => {
      describe("Loan is Requested", () => {
        it("reverts if called by PM or borrower", async () => {
          const { loan, borrower, poolManager } = await loadFixture(
            deployFixture
          );

          expect(await loan.state()).to.equal(0); // Requested

          await expect(
            loan.connect(poolManager).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");

          await expect(
            loan.connect(borrower).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");
        });
      });

      describe("Loan is Collateralized", () => {
        it("reverts if called by PM or borrower", async () => {
          const { loan, poolManager, collateralAsset, borrower } =
            await loadFixture(deployFixture);

          // Post collateral
          await collateralizeLoan(loan, borrower, collateralAsset);
          expect(await loan.state()).to.equal(1); // Collateralized

          await expect(
            loan.connect(poolManager).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");

          await expect(
            loan.connect(borrower).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");
        });
      });

      describe("Loan is Canceled", () => {
        it("reverts if called by PM", async () => {
          const { loan, poolManager, borrower } = await loadFixture(
            deployFixture
          );

          // cancel loan
          await loan.connect(borrower).cancelRequested();
          expect(await loan.state()).to.equal(2); // canceled

          await expect(
            loan.connect(poolManager).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");
        });

        it("does not revert if called by the borrower", async () => {
          const { loan, borrower } = await loadFixture(deployFixture);

          // cancel loan
          await loan.connect(borrower).cancelRequested();
          expect(await loan.state()).to.equal(2); // canceled

          await expect(loan.connect(borrower).claimCollateral([], [])).to.not.be
            .reverted;
        });
      });

      describe("Loan is funded", () => {
        it("reverts if called by PM or borrower", async () => {
          const { loan, poolManager, pool, borrower, collateralAsset } =
            await loadFixture(deployFixture);

          // collateralize and fund loan
          await collateralizeLoan(loan, borrower, collateralAsset);
          await pool.connect(poolManager).fundLoan(loan.address);
          expect(await loan.state()).to.equal(4); // funded

          await expect(
            loan.connect(poolManager).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");

          await expect(
            loan.connect(borrower).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");
        });
      });

      describe("Loan is Defaulted", () => {
        it("reverts if called by the borrower", async () => {
          const { loan, poolManager, pool, borrower, collateralAsset } =
            await loadFixture(deployFixture);

          // fund loan and default it
          await collateralizeLoan(loan, borrower, collateralAsset);
          await pool.connect(poolManager).fundLoan(loan.address);
          await loan.connect(borrower).drawdown(await loan.principal());
          await pool.connect(poolManager).defaultLoan(loan.address);
          expect(await loan.state()).to.equal(3); // defaulted

          await expect(
            loan.connect(borrower).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");
        });

        it("PM can attempt claim", async () => {
          const { loan, poolManager, pool, borrower, collateralAsset } =
            await loadFixture(deployFixture);

          // fund loan and default it
          await collateralizeLoan(loan, borrower, collateralAsset);
          await pool.connect(poolManager).fundLoan(loan.address);
          await loan.connect(borrower).drawdown(await loan.principal());
          await pool.connect(poolManager).defaultLoan(loan.address);
          expect(await loan.state()).to.equal(3); // defaulted

          await expect(loan.connect(poolManager).claimCollateral([], [])).to.not
            .be.reverted;
        });
      });

      describe("Loan is Matured", () => {
        it("Reverts if called by PM", async () => {
          const {
            loan,
            poolManager,
            liquidityAsset,
            pool,
            borrower,
            collateralAsset
          } = await loadFixture(deployFixture);

          // fund and mature loan
          await collateralizeLoan(loan, borrower, collateralAsset);
          await fundLoan(loan, pool, poolManager);
          await loan.connect(borrower).drawdown(await loan.principal());
          await matureLoan(loan, borrower, liquidityAsset);
          expect(await loan.state()).to.equal(5); // matured

          await expect(
            loan.connect(poolManager).claimCollateral([], [])
          ).to.be.revertedWith("Loan: unable to claim collateral");
        });

        it("Allows borrower to claim collateral", async () => {
          const {
            loan,
            poolManager,
            liquidityAsset,
            pool,
            borrower,
            collateralAsset
          } = await loadFixture(deployFixture);

          // fund and mature loan
          await collateralizeLoan(loan, borrower, collateralAsset);
          await fundLoan(loan, pool, poolManager);
          await loan.connect(borrower).drawdown(await loan.principal());
          await matureLoan(loan, borrower, liquidityAsset);
          expect(await loan.state()).to.equal(5); // matured

          await expect(loan.connect(borrower).claimCollateral([], [])).to.not.be
            .reverted;
        });
      });
    });

    it("returns only collateral requested", async () => {
      const { loan, borrower, collateralAsset, nftAsset } = await loadFixture(
        deployFixture
      );

      // post fungible and non-fungible collateral
      const { fungibleAmount } = await collateralizeLoan(
        loan,
        borrower,
        collateralAsset
      );
      const { tokenId } = await collateralizeLoanNFT(loan, borrower, nftAsset);

      // Cancel loan
      await time.increaseTo(await loan.dropDeadTimestamp());
      await loan.connect(borrower).cancelCollateralized();

      // Claim ERC20
      const txn1 = await loan
        .connect(borrower)
        .claimCollateral([collateralAsset.address], []);
      await expect(txn1).to.changeTokenBalance(
        collateralAsset,
        borrower.address,
        +fungibleAmount
      );
      await expect(txn1).to.changeTokenBalance(
        collateralAsset,
        await loan._collateralVault(),
        -fungibleAmount
      );
      await expect(txn1)
        .to.emit(loan, "WithdrewCollateral")
        .withArgs(collateralAsset.address, fungibleAmount);

      // Claim NFT
      expect(await nftAsset.ownerOf(tokenId)).to.not.equal(borrower.address);
      const txn2 = await loan.connect(borrower).claimCollateral(
        [],
        [
          {
            asset: nftAsset.address,
            tokenId: tokenId
          }
        ]
      );
      await expect(txn2)
        .to.emit(loan, "WithdrewNonFungibleCollateral")
        .withArgs(nftAsset.address, tokenId);

      expect(await nftAsset.ownerOf(tokenId)).to.equal(borrower.address);
    });

    it("reverts if unrecognized asset is requested", async () => {
      const { loan, borrower, collateralAsset, nftAsset } = await loadFixture(
        deployFixture
      );

      // post fungible and non-fungible collateral
      await collateralizeLoan(loan, borrower, collateralAsset);
      const { tokenId } = await collateralizeLoanNFT(loan, borrower, nftAsset);

      // Cancel loan
      await time.increaseTo(await loan.dropDeadTimestamp());
      await loan.connect(borrower).cancelCollateralized();

      // Pass incorrect / unrecognized fungible asset
      await expect(
        loan.connect(borrower).claimCollateral([nftAsset.address], [])
      ).to.be.revertedWith("SafeERC20: low-level call failed");

      // Pass incorrect / unrecognized nonfungible asset
      await expect(
        loan.connect(borrower).claimCollateral(
          [],
          [
            {
              asset: collateralAsset.address,
              tokenId: tokenId
            }
          ]
        )
      ).to.be.reverted;
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

      // Fixed term loans must drawdown the full amount
      const invalidDrawDownTx = loan.connect(borrower).drawdown(1);
      await expect(invalidDrawDownTx).to.be.reverted;

      // Draw down the funds
      const drawDownTx = loan
        .connect(borrower)
        .drawdown(await loan.principal());
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
      const drawDownTx2 = loan
        .connect(borrower)
        .drawdown(await loan.principal());
      await expect(drawDownTx2).to.be.revertedWith("LoanLib: invalid state");
    });
  });

  describe("markDefaulted", () => {
    it("reverts if not called by pool", async () => {
      const { loan, other } = await loadFixture(deployFixture);

      await expect(loan.connect(other).markDefaulted()).to.be.revertedWith(
        "Loan: caller is not pool"
      );
    });

    it("transitions state only if defaulted while in an Active state", async () => {
      const fixture = await loadFixture(deployFixture);
      const { borrower, collateralAsset, poolManager } = fixture;
      const loan = fixture.loan.connect(borrower);
      const pool = fixture.pool.connect(poolManager);

      // Check Loan is in requested state; defaults should revert
      expect(await loan.state()).to.equal(0);
      await expect(pool.defaultLoan(loan.address)).to.be.revertedWith(
        "Pool: unfunded loan"
      );

      // Loan is collateralized; defaults should still revert
      await collateralAsset.connect(borrower).approve(loan.address, 100);
      await loan.postFungibleCollateral(collateralAsset.address, 100);
      expect(await loan.state()).to.equal(1);
      await expect(pool.defaultLoan(loan.address)).to.be.revertedWith(
        "Pool: unfunded loan"
      );

      // Loan is funded; defaults should still revert
      await pool.fundLoan(loan.address);
      expect(await loan.state()).to.equal(4);
      await expect(pool.defaultLoan(loan.address)).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );

      // Loan is now Active
      await loan.connect(borrower).drawdown(await loan.principal());
      expect(await loan.state()).to.equal(6); // active

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
      await loan.connect(borrower).drawdown(await loan.principal());

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

    it("can complete the next payment if late", async () => {
      const fixture = await loadFixture(deployFixtureWithLateFees);
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
      await loan.connect(borrower).drawdown(await loan.principal());

      // Advance time to drop dead timestamp
      const foo = await loan.paymentDueDate();
      await time.increaseTo(foo.add(100));

      // Make payment
      const firstLoss = await pool.firstLossVault();
      const dueDate = await loan.paymentDueDate();
      expect(await loan.paymentsRemaining()).to.equal(6);
      await liquidityAsset.connect(borrower).approve(loan.address, 3083);
      const tx = loan.connect(borrower).completeNextPayment();
      await expect(tx).to.not.be.reverted;
      await expect(tx).to.changeTokenBalance(liquidityAsset, borrower, -3083);
      await expect(tx).to.changeTokenBalance(liquidityAsset, pool, 1979 + 1000);
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
      await loan.connect(borrower).drawdown(await loan.principal());

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
      await loan.connect(borrower).drawdown(await loan.principal());

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
      expect(await loan.state()).to.equal(6);
      await loan.connect(borrower).completeFullPayment();
      expect(await loan.paymentsRemaining()).to.equal(0);
      expect(await loan.state()).to.equal(5);
    });

    it("can collect pool fees from the next payment", async () => {
      const fixture = await loadFixture(deployFixturePoolFees);
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
      await loan.connect(borrower).drawdown(await loan.principal());
      expect(await pool.poolFeePercentOfInterest()).to.equal(100);

      // Make payment
      const firstLoss = await pool.firstLossVault();
      const feeVault = await pool.feeVault();
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

    it("can collect origination fees from the next payment", async () => {
      const fixture = await loadFixture(deployFixtureOriginationFees);
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
      await loan.connect(borrower).drawdown(await loan.principal());
      expect(await loan.originationFee()).to.equal(416);

      // Make payment
      const firstLoss = await pool.firstLossVault();
      const feeVault = await pool.feeVault();
      const dueDate = await loan.paymentDueDate();
      expect(await loan.paymentsRemaining()).to.equal(6);
      await liquidityAsset.connect(borrower).approve(loan.address, 2083 + 416);
      const tx = loan.connect(borrower).completeNextPayment();
      await expect(tx).to.not.be.reverted;
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        borrower,
        -2083 - 416
      );
      await expect(tx).to.changeTokenBalance(liquidityAsset, pool, 1979);
      await expect(tx).to.changeTokenBalance(liquidityAsset, feeVault, 416);
      await expect(tx).to.changeTokenBalance(liquidityAsset, firstLoss, 104);
      expect(await loan.paymentsRemaining()).to.equal(5);
      const newDueDate = await loan.paymentDueDate();
      expect(newDueDate).to.equal(dueDate.add(THIRTY_DAYS));
    });
  });

  describe("callbacks", () => {
    it("can be called back by pool admin", async () => {
      const fixture = await loadFixture(deployFixture);
      const { poolManager, loan } = fixture;

      // Callback timestamp defaults to 0
      expect(await loan.callbackTimestamp()).to.equal(0);

      const tx = loan.connect(poolManager).markCallback();
      await expect(tx).not.to.be.reverted;

      // Callback timestamp should be set to latest block timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      expect(await loan.callbackTimestamp()).to.equal(now);
    });

    it("can only be called back by pool admin", async () => {
      const fixture = await loadFixture(deployFixture);
      const { loan, other } = fixture;

      // Setup
      const tx = loan.connect(other).markCallback();
      await expect(tx).to.be.reverted;
    });
  });

  describe("open term loans", () => {
    it("open term loans can draw down up to their remaining principal", async () => {
      const fixture = await loadFixture(deployFixtureOpenTerm);
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
      const drawDownTx = loan.connect(borrower).drawdown(1_000);
      await expect(drawDownTx).not.to.be.reverted;
      await expect(drawDownTx).to.changeTokenBalance(
        liquidityAsset,
        borrower.address,
        1_000
      );
      await expect(drawDownTx).to.changeTokenBalance(
        liquidityAsset,
        await loan.fundingVault(),
        -1_000
      );
      await expect(drawDownTx)
        .to.emit(loan, "LoanDrawnDown")
        .withArgs(loan.liquidityAsset, 1_000);

      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      expect(await loan.paymentDueDate()).to.equal(now + THIRTY_DAYS);

      // Open term loans can drawdown repeatedly until funding is no longer available.
      const drawDownTx2 = loan.connect(borrower).drawdown(100);
      await expect(drawDownTx2).not.to.be.reverted;
    });

    it("open term loans can payoff the entire loan at once", async () => {
      const fixture = await deployFixtureOpenTerm();
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
      await loan.connect(borrower).drawdown(await loan.principal());

      // Funding vault will now have no tokens.
      const fundingVault = await loan.fundingVault();
      expect(await liquidityAsset.balanceOf(fundingVault)).to.equal(0);

      // Mint additional tokens to cover the interest payments
      await liquidityAsset.mint(borrower.address, 12498);

      // Repay some of the principal
      const prepaidPrincipal = 1_000;
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, prepaidPrincipal);
      expect(await loan.outstandingPrincipal()).to.equal(500_000);
      await loan.connect(borrower).paydownPrincipal(prepaidPrincipal);
      expect(await loan.outstandingPrincipal()).to.equal(
        500_000 - prepaidPrincipal
      );
      expect(await liquidityAsset.balanceOf(fundingVault)).to.equal(
        prepaidPrincipal
      );

      // Make payment
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, 12498 + 500_000);

      // Fast forward half of the payment period
      // Relative to a full month payments, the fees will be halved
      await time.increase(THIRTY_DAYS / 2);
      const firstLossFee = 52;
      const poolAdminFee = 208;
      const interestPayment = 1041;
      const principal = 500_000;
      const originationFee = 208;

      const tx = loan.connect(borrower).completeFullPayment();
      await expect(tx).to.not.be.reverted;
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        borrower,
        0 - interestPayment - principal - originationFee + prepaidPrincipal
      );
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        pool,
        interestPayment + principal - prepaidPrincipal - firstLossFee
      );

      const firstLoss = await pool.firstLossVault();
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        firstLoss,
        firstLossFee
      );
      await expect(tx).to.changeTokenBalance(
        liquidityAsset,
        await pool.feeVault(),
        poolAdminFee
      );

      expect(await loan.paymentsRemaining()).to.equal(0);
      expect(await loan.state()).to.equal(5);

      // Funding vault will still have funds in it
      expect(await liquidityAsset.balanceOf(fundingVault)).to.equal(
        prepaidPrincipal
      );

      // Pool Manager can then reclaim the funds
      const reclaimFundsTx = loan
        .connect(poolManager)
        .reclaimFunds(prepaidPrincipal);
      await expect(reclaimFundsTx).to.not.be.reverted;
      await expect(reclaimFundsTx).to.changeTokenBalance(
        liquidityAsset,
        fundingVault,
        -1 * prepaidPrincipal
      );
      await expect(reclaimFundsTx).to.changeTokenBalance(
        liquidityAsset,
        pool,
        prepaidPrincipal
      );
    });
  });

  const findEventByName = (receipt, name) => {
    return receipt.events?.find((event) => event.event == name);
  };
});
