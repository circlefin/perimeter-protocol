import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployServiceConfiguration } from "./support/serviceconfiguration";

describe("TermsOfServiceConsentRegistry", () => {
  const TOS_URL = "https://example.xyz/tos";

  async function deployFixture() {
    const [operator, otherAccount] = await ethers.getSigners();

    const { serviceConfiguration } = await deployServiceConfiguration();

    const TermsOfServiceConsentRegistry = await ethers.getContractFactory(
      "TermsOfServiceConsentRegistry"
    );
    const registry = await TermsOfServiceConsentRegistry.deploy(
      serviceConfiguration.address
    );
    await registry.deployed();

    return {
      registry,
      operator,
      otherAccount,
      serviceConfiguration
    };
  }

  describe("Deployment", async () => {
    it("terms of service URL is empty", async () => {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.termsOfService()).to.be.empty;
    });
  });

  describe("updateTermsOfService()", async () => {
    it("can only be called by service operator", async () => {
      const { registry, operator, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(
        registry.connect(otherAccount).updateTermsOfService(TOS_URL)
      ).to.be.revertedWith("ToS: not operator");

      await expect(registry.connect(operator).updateTermsOfService(TOS_URL)).to
        .not.be.reverted;
    });

    it("updates the stored terms of service", async () => {
      const { registry, operator } = await loadFixture(deployFixture);

      expect(await registry.termsOfService()).to.be.empty;
      await expect(registry.connect(operator).updateTermsOfService(TOS_URL)).to
        .not.be.reverted;
      expect(await registry.termsOfService()).to.equal(TOS_URL);
    });

    it("emits and event when the ToS URL is updated", async () => {
      const { registry, operator } = await loadFixture(deployFixture);

      await expect(
        registry.connect(operator).updateTermsOfService("test1")
      ).to.emit(registry, "TermsOfServiceUpdated");
    });
  });

  describe("recordConsent()", async () => {
    it("reverts if ToS haven't been set", async () => {
      const { registry, otherAccount } = await loadFixture(deployFixture);

      await expect(
        registry.connect(otherAccount).recordConsent()
      ).to.be.revertedWith("ToS: not set");
    });

    it("records consent record", async () => {
      const { registry, operator, otherAccount } = await loadFixture(
        deployFixture
      );
      expect(await registry.hasConsented(otherAccount.address)).to.be.false;

      await registry.connect(operator).updateTermsOfService("test1");
      await registry.connect(otherAccount).recordConsent();

      expect(await registry.hasConsented(otherAccount.address)).to.be.true;
    });
  });
});
