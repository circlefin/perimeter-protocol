import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPermissionedPool } from "../support/pool";

describe("PermissionedPool", () => {
  async function loadPoolFixture() {
    const [operator, poolAdmin, otherAccount, thirdAccount, allowedLender] =
      await ethers.getSigners();
    const {
      pool,
      liquidityAsset,
      poolAccessControl,
      tosAcceptanceRegistry,
      poolController
    } = await deployPermissionedPool({
      operator,
      poolAdmin: poolAdmin
    });

    // allow allowedLender
    await tosAcceptanceRegistry.connect(allowedLender).acceptTermsOfService();
    await poolAccessControl
      .connect(poolAdmin)
      .allowParticipant(allowedLender.address);

    return {
      pool,
      poolController,
      liquidityAsset,
      poolAdmin,
      otherAccount,
      thirdAccount,
      allowedLender
    };
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

    describe("crank()", () => {
      it("reverts if not allowed lender or admin", async () => {
        const { pool, otherAccount } = await loadFixture(loadPoolFixture);

        await expect(pool.connect(otherAccount).crank()).to.be.revertedWith(
          "Pool: not allowed"
        );
      });

      it("cranks the pool if allowed lender", async () => {
        const { pool, allowedLender } = await loadFixture(loadPoolFixture);

        await expect(pool.connect(allowedLender).crank()).to.emit(
          pool,
          "PoolCranked"
        );
      });

      it("cranks the pool if PA via poolController", async () => {
        const { pool, poolAdmin, poolController } = await loadFixture(
          loadPoolFixture
        );

        await expect(poolController.connect(poolAdmin).crank()).to.emit(
          pool,
          "PoolCranked"
        );
      });
    });
  });
});
