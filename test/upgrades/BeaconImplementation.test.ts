import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BeaconImplementation", () => {
  async function deployFixture() {
    const MockBeaconImplementation = await ethers.getContractFactory(
      "MockBeaconImplementation"
    );
    const mockBeaconImplementation = await MockBeaconImplementation.deploy();
    await mockBeaconImplementation.deployed();

    return {
      mockBeaconImplementation
    };
  }

  it("parents constructor is called", async () => {
    const { mockBeaconImplementation } = await loadFixture(deployFixture);

    // Since the parent calls _disableInitializers() in its constructor,
    // we expect any calls to initialize() to fail.
    await expect(mockBeaconImplementation.initialize()).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
  });
});
