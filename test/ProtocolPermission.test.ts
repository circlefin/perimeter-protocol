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
      "ProtocolPermission"
    );
    const protocolPermission = await ProtocolPermission.deploy();

    return { protocolPermission, owner, otherAccount };
  }

  it("isAllowed() returns true at all times", async () => {
    const { protocolPermission, otherAccount } = await loadFixture(
      deployFixture
    );

    expect(
      await protocolPermission.isAllowed(otherAccount.getAddress())
    ).to.equal(true);
  });
});
