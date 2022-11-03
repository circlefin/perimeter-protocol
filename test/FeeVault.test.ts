import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPool } from "./support/pool";

describe("FeeVault", () => {
  const VAULT_BALANCE = ethers.BigNumber.from(100);

  async function deployFixture() {
    const [operator, poolAdmin, otherAccount] = await ethers.getSigners();

    const { pool } = await deployPool({ operator, poolAdmin });

    const FeeVault = await ethers.getContractFactory("FeeVault");
    const feeVault = await FeeVault.deploy(pool.address);
    await feeVault.deployed();

    const Asset = await ethers.getContractFactory("MockERC20");
    const asset = await Asset.deploy("Test Coin", "TC", 18);
    await asset.deployed();
    await asset.mint(feeVault.address, VAULT_BALANCE);

    return {
      asset,
      feeVault,
      pool,
      poolAdmin,
      otherAccount
    };
  }

  describe("Deployment", async () => {
    it("sets the pool", async () => {
      const { feeVault, pool } = await loadFixture(deployFixture);

      expect(await feeVault.pool()).to.equal(pool.address);
    });
  });

  describe("withdraw()", async () => {
    it("pool manager can withdraw amounts", async () => {
      const { feeVault, asset, pool, poolAdmin } = await loadFixture(
        deployFixture
      );

      const amount = 50;

      // Pull funds from locker
      const tx = feeVault.connect(poolAdmin).withdraw(asset.address, amount);

      await expect(tx).not.to.be.reverted;
      await expect(tx).to.changeTokenBalance(asset, feeVault, -1 * amount);
      await expect(tx).to.changeTokenBalance(asset, poolAdmin, amount);
    });

    it("if not pool admin, cannot withdraw", async () => {
      const { asset, feeVault, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(
        feeVault.connect(otherAccount).withdraw(asset.address, 50)
      ).to.be.revertedWith("FeeVault: caller not pool admin");
    });
  });
});
