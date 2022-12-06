import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * This is a simple test to demonstrate modifier inheritance. It is crucial
 * that super is called, otherwise the modifier is not inherited.
 */
describe("modifier inheritance", () => {
  it("reverts calling the base class", async () => {
    const MockChild = await ethers.getContractFactory("MockChild");
    const mockChild = await MockChild.deploy();

    const tx = mockChild.foo();
    await expect(tx).to.be.reverted;
  });

  it("reverts if you inherit and call super", async () => {
    const MockChild = await ethers.getContractFactory("MockChild2");
    const mockChild = await MockChild.deploy();

    const tx = mockChild.foo();
    await expect(tx).to.be.reverted;
  });

  it("doesn't revert if you inherit but don't call super", async () => {
    const MockChild = await ethers.getContractFactory("MockChild3");
    const mockChild = await MockChild.deploy();

    const tx = mockChild.foo();
    await expect(tx).not.to.be.reverted;
  });
});
