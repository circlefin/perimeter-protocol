import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPermissionedPool } from "../support/pool";

describe("PermissionedPool", () => {
  async function loadPoolFixture() {
    const [operator, poolAdmin, otherAccount, thirdAccount] =
      await ethers.getSigners();
    const { pool, liquidityAsset } = await deployPermissionedPool({
      operator,
      poolAdmin: poolAdmin
    });

    return { pool, liquidityAsset, poolAdmin, otherAccount, thirdAccount };
  }

  describe("maxMint()", async () => {
    it("returns 0 if lender or receiver not in access control list", async () => {
      const { pool, otherAccount, thirdAccount } = await loadFixture(
        loadPoolFixture
      );

      expect(
        await pool.connect(otherAccount).maxMint(thirdAccount.address)
      ).to.equal(0);
    });
  });

  describe("maxDeposit()", async () => {
    it("returns 0 if lender or receiver not in access control list", async () => {
      const { pool, otherAccount, thirdAccount } = await loadFixture(
        loadPoolFixture
      );

      expect(
        await pool.connect(otherAccount).maxMint(thirdAccount.address)
      ).to.equal(0);
    });
  });

  describe("Permissions", () => {
    describe("deposit()", () => {
      it("reverts if not allowed lender", async () => {
        const { pool, otherAccount, thirdAccount } = await loadFixture(
          loadPoolFixture
        );

        await expect(
          pool.connect(otherAccount).deposit(10, thirdAccount.address)
        ).to.be.revertedWith("caller is not a valid lender");
      });
    });

    describe("mint()", () => {
      it("reverts if not allowed lender", async () => {
        const { pool, otherAccount, thirdAccount } = await loadFixture(
          loadPoolFixture
        );

        await expect(
          pool.connect(otherAccount).mint(10, thirdAccount.address)
        ).to.be.revertedWith("caller is not a valid lender");
      });
    });
  });
});
