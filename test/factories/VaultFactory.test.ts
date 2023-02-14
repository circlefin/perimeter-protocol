import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { getCommonSigners } from "../support/utils";
import { deployServiceConfiguration } from "../support/serviceconfiguration";

describe("VaultFactory", () => {
  async function deployVaultFactoryFixture() {
    const { deployer, other } = await getCommonSigners();
    const { serviceConfiguration } = await deployServiceConfiguration();

    const Factory = await ethers.getContractFactory("VaultFactory");
    const factory = await Factory.deploy(serviceConfiguration.address);

    // Create Vault implementation
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();
    return {
      vault,
      factory,
      deployer,
      other
    };
  }

  describe("createVault()", () => {
    it("reverts if no implementation is set", async () => {
      const { factory, other } = await loadFixture(deployVaultFactoryFixture);

      await expect(factory.createVault(other.address)).to.be.revertedWith(
        "VaultFactory: no implementation set"
      );
    });
  });
});
