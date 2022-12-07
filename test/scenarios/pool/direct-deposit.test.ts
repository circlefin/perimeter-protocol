import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { activatePool, deployPool } from "../../support/pool";
import { getCommonSigners } from "../../support/utils";

describe("Direct Deposit", () => {
  async function loadPoolFixture() {
    const { poolAdmin, lender } = await getCommonSigners();

    const { pool, liquidityAsset } = await deployPool({
      poolAdmin
    });

    await activatePool(pool, poolAdmin, liquidityAsset);

    await liquidityAsset.mint(lender.address, 250_000);
    await liquidityAsset.connect(lender).approve(pool.address, 500_000);

    return {
      pool,
      liquidityAsset,
      lender
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
  });
});
