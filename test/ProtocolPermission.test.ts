import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ProtocolPermission", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const ProtocolPermission = await ethers.getContractFactory(
      "ProtocolPermission",
      owner
    );
    const protocolPermission = await ProtocolPermission.deploy();

    await protocolPermission.deployed();

    return { protocolPermission, owner, otherAccount };
  }

  describe("addToAllowList()", () => {
    it("adds an address to the allowList", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await protocolPermission.addToAllowList(otherAccount.getAddress());

      expect(
        await protocolPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(true);
    });

    it("reverts if the address is already in the allowList", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await protocolPermission.addToAllowList(otherAccount.getAddress());

      await expect(
        protocolPermission.addToAllowList(otherAccount.getAddress())
      ).to.be.revertedWith("Address is already allowed");
    });

    it("emits an AllowListUpdated event upon success", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      expect(await protocolPermission.addToAllowList(otherAccount.getAddress()))
        .to.emit(protocolPermission, "AllowListUpdated")
        .withArgs(otherAccount.getAddress(), true);
    });
  });

  describe("removeFromAllowList()", () => {
    it("removes an address from the allowList", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await protocolPermission.addToAllowList(otherAccount.getAddress());
      await protocolPermission.removeFromAllowList(otherAccount.getAddress());

      expect(
        await protocolPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    it("reverts if the address is not in the allowList", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(
        protocolPermission.removeFromAllowList(otherAccount.getAddress())
      ).to.be.revertedWith("Address is not already allowed");
    });

    it("emits an AllowListUpdated event upon success", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await protocolPermission.addToAllowList(otherAccount.getAddress());

      expect(
        await protocolPermission.removeFromAllowList(otherAccount.getAddress())
      )
        .to.emit(protocolPermission, "AllowListUpdated")
        .withArgs(otherAccount.getAddress(), false);
    });
  });

  describe("isAllowed()", () => {
    it("returns false if the address is not in the allow list", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      expect(
        await protocolPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    it("returns true if the address is allowed", async () => {
      const { protocolPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await protocolPermission.addToAllowList(otherAccount.getAddress());

      expect(
        await protocolPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(true);
    });
  });
});
