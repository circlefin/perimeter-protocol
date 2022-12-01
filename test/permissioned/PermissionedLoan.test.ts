import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import {
  deployPermissionedLoan,
  DEFAULT_LOAN_SETTINGS,
  collateralizeLoan,
  collateralizeLoanNFT,
  fundLoan
} from "../support/loan";
import {
  activatePool,
  DEFAULT_POOL_SETTINGS,
  deployPermissionedPool,
  depositToPool
} from "../support/pool";

describe("PermissionedLoan", () => {
  async function loadLoanFixture() {
    const [operator, poolAdmin, borrower, lender] = await ethers.getSigners();

    const { mockERC20: liquidityAsset } = await deployMockERC20();
    const NftAsset = await ethers.getContractFactory("MockERC721");
    const nftAsset = await NftAsset.deploy(
      "Valyria NFT",
      "VAL",
      "http://example.com/"
    );
    await nftAsset.deployed();

    const {
      pool,
      tosAcceptanceRegistry,
      serviceConfiguration,
      poolController
    } = await deployPermissionedPool({
      operator,
      poolAdmin: poolAdmin,
      settings: DEFAULT_POOL_SETTINGS,
      liquidityAsset: liquidityAsset
    });

    const { loan } = await deployPermissionedLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      operator,
      serviceConfiguration
    );

    // Mint ERC20 for lender
    await liquidityAsset.mint(lender.address, DEFAULT_LOAN_SETTINGS.principal);
    await liquidityAsset
      .connect(lender)
      .approve(pool.address, DEFAULT_LOAN_SETTINGS.principal);

    const poolAccessControlAddr = await pool.poolAccessControl();
    const poolAccessControl = await ethers.getContractAt(
      "PoolAccessControl",
      poolAccessControlAddr
    );

    // Allow lender to participate in pool
    await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();
    await poolAccessControl.connect(poolAdmin).allowParticipant(lender.address);

    return {
      loan,
      pool,
      poolController,
      borrower,
      poolAdmin,
      poolAccessControl,
      liquidityAsset,
      tosAcceptanceRegistry,
      lender,
      nftAsset
    };
  }

  describe("Deployment", () => {
    it("associates sets the correct pool access control address", async () => {
      const { loan, pool } = await loadFixture(loadLoanFixture);

      expect(await loan.poolAccessControl()).to.equal(
        await pool.poolAccessControl()
      );
    });
  });

  describe("postFungibleCollateral()", () => {
    it("posts collateral for valid participants", async () => {
      const {
        loan,
        tosAcceptanceRegistry,
        borrower,
        poolAdmin,
        poolAccessControl,
        liquidityAsset
      } = await loadFixture(loadLoanFixture);

      // allow borrower
      await tosAcceptanceRegistry.connect(borrower).acceptTermsOfService();
      await poolAccessControl
        .connect(poolAdmin)
        .allowParticipant(borrower.address);

      await liquidityAsset.mint(borrower.address, 1);
      await liquidityAsset.connect(borrower).approve(loan.address, 1);
      await expect(
        loan.connect(borrower).postFungibleCollateral(liquidityAsset.address, 1)
      ).to.emit(loan, "PostedCollateral");
    });
  });

  describe("postNonFungibleCollateral()", () => {
    it("posts collateral for valid participants", async () => {
      const {
        loan,
        tosAcceptanceRegistry,
        borrower,
        poolAdmin,
        poolAccessControl,
        nftAsset
      } = await loadFixture(loadLoanFixture);

      // allow borrower
      await tosAcceptanceRegistry.connect(borrower).acceptTermsOfService();
      await poolAccessControl
        .connect(poolAdmin)
        .allowParticipant(borrower.address);

      let postedNft = await loan.nonFungibleCollateral();
      expect(postedNft.length).to.equal(0);

      const { tokenId } = await collateralizeLoanNFT(loan, borrower, nftAsset);

      postedNft = await loan.nonFungibleCollateral();
      expect(postedNft.length).to.equal(1);
      expect(postedNft[0].tokenId).to.equal(tokenId);
    });
  });

  describe("drawdown()", () => {
    it("allows drawing down for valid participants", async () => {
      const {
        pool,
        poolController,
        tosAcceptanceRegistry,
        poolAdmin,
        lender,
        loan,
        borrower,
        poolAccessControl,
        liquidityAsset
      } = await loadFixture(loadLoanFixture);

      // Set borrower to be valid for the purposes of collateralizing the loan
      await tosAcceptanceRegistry.connect(borrower).acceptTermsOfService();
      await poolAccessControl
        .connect(poolAdmin)
        .allowParticipant(borrower.address);

      // collateralize and fund loan
      await activatePool(pool, poolAdmin, liquidityAsset);
      const principal = DEFAULT_LOAN_SETTINGS.principal;
      await depositToPool(pool, lender, liquidityAsset, principal);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, poolController, poolAdmin);

      // Rollback access for borrower
      const txn = await loan.connect(borrower).drawdown(principal);
      expect(txn).to.changeTokenBalance(liquidityAsset, borrower, +principal);
    });
  });

  describe("Permissions", () => {
    describe("postFungibleCollateral()", async () => {
      it("reverts if borrower not allowed participant", async () => {
        const { loan, borrower, poolAccessControl, liquidityAsset } =
          await loadFixture(loadLoanFixture);

        expect(await poolAccessControl.isAllowed(borrower.address)).to.be.false;
        await expect(
          loan
            .connect(borrower)
            .postFungibleCollateral(liquidityAsset.address, 10)
        ).to.be.revertedWith("BORROWER_NOT_ALLOWED");
      });
    });

    describe("postNonFungibleCollateral()", async () => {
      it("reverts if borrower not allowed participant", async () => {
        const { loan, borrower, poolAccessControl, liquidityAsset } =
          await loadFixture(loadLoanFixture);

        expect(await poolAccessControl.isAllowed(borrower.address)).to.be.false;
        await expect(
          loan
            .connect(borrower)
            .postNonFungibleCollateral(liquidityAsset.address, "123")
        ).to.be.revertedWith("BORROWER_NOT_ALLOWED");
      });
    });

    describe("drawdown()", async () => {
      it("reverts if borrower not allowed participant", async () => {
        const {
          pool,
          poolController,
          tosAcceptanceRegistry,
          poolAdmin,
          lender,
          loan,
          borrower,
          poolAccessControl,
          liquidityAsset
        } = await loadFixture(loadLoanFixture);

        // Set borrower to be valid for the purposes of collateralizing the loan
        await tosAcceptanceRegistry.connect(borrower).acceptTermsOfService();
        await poolAccessControl
          .connect(poolAdmin)
          .allowParticipant(borrower.address);

        // collateralize and fund loan
        await activatePool(pool, poolAdmin, liquidityAsset);
        await depositToPool(
          pool,
          lender,
          liquidityAsset,
          DEFAULT_LOAN_SETTINGS.principal
        );
        await collateralizeLoan(loan, borrower, liquidityAsset);
        await fundLoan(loan, poolController, poolAdmin);

        // Rollback access for borrower
        await poolAccessControl
          .connect(poolAdmin)
          .removeParticipant(borrower.address);
        await expect(loan.connect(borrower).drawdown(1)).to.be.revertedWith(
          "BORROWER_NOT_ALLOWED"
        );
      });
    });

    describe("cancelCollateralized()", () => {
      it("reverts if borrower not an allowed participant", async () => {
        const { loan, borrower } = await loadFixture(loadLoanFixture);

        await expect(
          loan.connect(borrower).cancelCollateralized()
        ).to.be.revertedWith("BORROWER_NOT_ALLOWED");
      });
    });

    describe("paydownPrincipal()", () => {
      it("reverts if borrower not an allowed participant", async () => {
        const { loan, borrower } = await loadFixture(loadLoanFixture);

        await expect(
          loan.connect(borrower).paydownPrincipal(100)
        ).to.be.revertedWith("BORROWER_NOT_ALLOWED");
      });
    });

    describe("completeNextPayment()", () => {
      it("reverts if borrower not an allowed participant", async () => {
        const { loan, borrower } = await loadFixture(loadLoanFixture);

        await expect(
          loan.connect(borrower).completeNextPayment()
        ).to.be.revertedWith("BORROWER_NOT_ALLOWED");
      });
    });

    describe("completeFullPayment()", () => {
      it("reverts if borrower not an allowed participant", async () => {
        const { loan, borrower } = await loadFixture(loadLoanFixture);

        await expect(
          loan.connect(borrower).completeFullPayment()
        ).to.be.revertedWith("BORROWER_NOT_ALLOWED");
      });
    });
  });
});
