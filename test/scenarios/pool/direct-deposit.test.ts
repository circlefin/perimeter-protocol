import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { deployLoan, fundLoan } from "../../support/loan";
import { activatePool, deployPool } from "../../support/pool";
import { getCommonSigners } from "../../support/utils";

describe("Direct Deposit", () => {
  async function loadPoolFixture() {
    const { poolAdmin, borrower, lender } = await getCommonSigners();

    const { pool, poolController, liquidityAsset, serviceConfiguration } =
      await deployPool({
        poolAdmin,
        settings: {
          firstLossInitialMinimum: 0
        }
      });

    await activatePool(pool, poolAdmin, liquidityAsset);

    await liquidityAsset.mint(lender.address, 250_000);
    await liquidityAsset.connect(lender).approve(pool.address, 500_000);

    return {
      pool,
      poolController,
      poolAdmin,
      liquidityAsset,
      lender,
      borrower,
      serviceConfiguration
    };
  }

  it("properly handles the case where someone directly transfers the liquidity asset to the pool without using mint()", async () => {
    // Deploy fresh fixtures and activate pool
    const { pool, liquidityAsset, lender } = await loadFixture(loadPoolFixture);

    // Ensure nothing is in the pool
    expect(await pool.totalAssets()).to.equal(0);
    expect(await pool.totalSupply()).to.equal(0);

    // expect a 1-to-1 ratio
    expect(await pool.connect(lender).previewMint(100_000)).to.equal(100_000);
    expect(await pool.connect(lender).previewDeposit(100_000)).to.equal(
      100_000
    );

    // Transfer some ERC20 to the pool directly (i.e. don’t deposit, but actually do an ERC20 transfer to the pool address)
    await liquidityAsset.connect(lender).transfer(pool.address, 100_000);

    // Ensure 100,000 assets are in the pool, but no pool tokens have been minted
    expect(await pool.totalAssets()).to.equal(100_000);
    expect(await pool.totalSupply()).to.equal(0);

    // preview the mint
    const assetsRequired = await pool.connect(lender).previewMint(100_000);
    expect(assetsRequired).to.equal(100_000);

    // expect the opposite side to return the same value (still a 1-to-1 ratio).
    const sharesExpected = await pool.connect(lender).previewDeposit(100_000);
    expect(sharesExpected).to.equal(assetsRequired);

    // Try to deposit
    await pool.connect(lender).mint(100_000, lender.address);

    // Ensure 200,000 assets are in the pool, an 100,000 pool tokens
    expect(await pool.totalAssets()).to.equal(200_000);
    expect(await pool.totalSupply()).to.equal(100_000);

    // Check withdrawal amounts
    expect(await pool.connect(lender).previewWithdrawRequest(100_000)).to.equal(
      52_500 // 50_000 plus fees
    );
    expect(await pool.connect(lender).previewRedeemRequest(100_000)).to.equal(
      190_000 // 200_000 minus fees
    );
  });

  it("properly handles the case where someone directly transfers the liquidity asset to the pool without using deposit()", async () => {
    // Deploy fresh fixtures and activate pool
    const { pool, liquidityAsset, lender } = await loadFixture(loadPoolFixture);

    // Ensure nothing is in the pool
    expect(await pool.totalAssets()).to.equal(0);
    expect(await pool.totalSupply()).to.equal(0);

    // Transfer some ERC20 to the pool directly (i.e. don’t deposit, but actually do an ERC20 transfer to the pool address)
    await liquidityAsset.connect(lender).transfer(pool.address, 100_000);

    // Ensure 100,000 assets are in the pool, but no pool tokens have been minted
    expect(await pool.totalAssets()).to.equal(100_000);
    expect(await pool.totalSupply()).to.equal(0);

    // preview the mint
    const sharesExpected = await pool.connect(lender).previewDeposit(100_000);
    expect(sharesExpected).to.equal(100_000);

    // Try to deposit
    await pool.connect(lender).deposit(100_000, lender.address);

    // Ensure 200,000 assets are in the pool, an 100,000 pool tokens
    expect(await pool.totalAssets()).to.equal(200_000);
    expect(await pool.totalSupply()).to.equal(100_000);

    // Check withdrawal amounts
    expect(await pool.connect(lender).previewWithdrawRequest(100_000)).to.equal(
      52_500 // 50_000 plus fees
    );
    expect(await pool.connect(lender).previewRedeemRequest(100_000)).to.equal(
      190_000 // 200_000 minus fees
    );
  });

  it("properly handles when the pool has zero assets, but has more tokens", async () => {
    // Deploy fresh fixtures and activate pool
    const {
      pool,
      poolController,
      poolAdmin,
      liquidityAsset,
      lender,
      borrower,
      serviceConfiguration
    } = await loadFixture(loadPoolFixture);

    // Deploy the loan
    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration,
      {
        principal: 100_000
      }
    );

    // Ensure nothing is in the pool
    expect(await pool.totalAssets()).to.equal(0);
    expect(await pool.totalSupply()).to.equal(0);

    // Deposit money
    await pool.connect(lender).deposit(100_000, lender.address);

    // fund loan
    await fundLoan(loan, poolController, poolAdmin);

    // draw down
    await loan.connect(borrower).drawdown(await loan.principal());

    // Mark loan as in default
    await poolController.connect(poolAdmin).defaultLoan(loan.address);

    // Ensure 0 assets are in the pool, an 100,000 pool tokens
    expect(await pool.totalAssets()).to.equal(0);
    expect(await pool.totalSupply()).to.equal(100_000);

    // Check what deposit, mint would look like:
    await expect(pool.connect(lender).previewMint(100_000)).to.be.revertedWith(
      "POOL_INSOLVENT"
    );

    await expect(
      pool.connect(lender).previewDeposit(100_000)
    ).to.be.revertedWith("POOL_INSOLVENT");
    await expect(
      pool.connect(lender).previewWithdrawRequest(100_000)
    ).to.be.revertedWith("POOL_INSOLVENT");
    await expect(
      pool.connect(lender).previewRedeemRequest(100_000)
    ).to.be.revertedWith("POOL_INSOLVENT");
  });
});
