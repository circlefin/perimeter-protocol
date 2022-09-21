import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolPermission", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [otherAccount] = await ethers.getSigners();

    // Deploy the PoolManagerPermission contract
    const PoolPermission = await ethers.getContractFactory("PoolPermission");
    const poolPermission = await PoolPermission.deploy();
    await poolPermission.deployed();

    return {
      poolPermission,
      otherAccount
    };
  }

  describe("isValidLender()", () => {
    it("should return true if the lender is valid", async () => {
      const { poolPermission, otherAccount } = await loadFixture(deployFixture);

      await poolPermission.allowLender(otherAccount.address);

      const isValidLender = await poolPermission.isValidLender(
        otherAccount.address
      );
      expect(isValidLender).to.be.true;
    });

    it("should return false if the lender is not valid", async () => {
      const { poolPermission } = await loadFixture(deployFixture);

      const isValidLender = await poolPermission.isValidLender(
        "0x0000000000000000000000000000000000000000"
      );

      expect(isValidLender).to.be.false;
    });
  });

  describe("isValidBorrower()", () => {
    it("should return true if the borrower is valid", async () => {
      const { poolPermission, otherAccount } = await loadFixture(deployFixture);

      await poolPermission.allowBorrower(otherAccount.address);

      const isValidBorrower = await poolPermission.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.true;
    });

    it("should return false if the borrower is not valid", async () => {
      const { poolPermission } = await loadFixture(deployFixture);

      const isValidBorrower = await poolPermission.isValidBorrower(
        "0x0000000000000000000000000000000000000000"
      );

      expect(isValidBorrower).to.be.false;
    });
  });

  describe("allowLender()", () => {
    it("should allow a lender", async () => {
      const { poolPermission, otherAccount } = await loadFixture(deployFixture);

      await poolPermission.allowLender(otherAccount.address);

      const isValidLender = await poolPermission.isValidLender(
        otherAccount.address
      );
      expect(isValidLender).to.be.true;
    });

    describe("events", () => {
      it("should emit a AllowedLenderListUpdated event", async () => {
        const { poolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(poolPermission.allowLender(otherAccount.address))
          .to.emit(poolPermission, "AllowedLenderListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("removeLender()", () => {
    it("should remove a lender", async () => {
      const { poolPermission, otherAccount } = await loadFixture(deployFixture);

      await poolPermission.allowLender(otherAccount.address);

      let isValidLender = await poolPermission.isValidLender(
        otherAccount.address
      );
      expect(isValidLender).to.be.true;

      await poolPermission.removeLender(otherAccount.address);

      isValidLender = await poolPermission.isValidLender(otherAccount.address);
      expect(isValidLender).to.be.false;
    });

    describe("events", () => {
      it("should emit a AllowedLenderListUpdated event", async () => {
        const { poolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(poolPermission.removeLender(otherAccount.address))
          .to.emit(poolPermission, "AllowedLenderListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });

  describe("allowBorrower()", () => {
    it("should allow a borrower", async () => {
      const { poolPermission, otherAccount } = await loadFixture(deployFixture);

      await poolPermission.allowBorrower(otherAccount.address);

      const isValidBorrower = await poolPermission.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.true;
    });

    describe("events", () => {
      it("should emit a AllowedBorrowerListUpdated event", async () => {
        const { poolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(poolPermission.allowBorrower(otherAccount.address))
          .to.emit(poolPermission, "AllowedBorrowerListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("removeBorrower()", () => {
    it("should remove a borrower", async () => {
      const { poolPermission, otherAccount } = await loadFixture(deployFixture);

      await poolPermission.allowBorrower(otherAccount.address);

      let isValidBorrower = await poolPermission.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.true;

      await poolPermission.removeBorrower(otherAccount.address);

      isValidBorrower = await poolPermission.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.false;
    });

    describe("events", () => {
      it("should emit a AllowedBorrowerListUpdated event", async () => {
        const { poolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(poolPermission.removeBorrower(otherAccount.address))
          .to.emit(poolPermission, "AllowedBorrowerListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });
});
