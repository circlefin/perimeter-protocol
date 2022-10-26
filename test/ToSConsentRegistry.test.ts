import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployServiceConfiguration } from "./support/serviceconfiguration";
import { deployToSAcceptanceRegistry } from "./support/tosacceptanceregistry";

describe("ToSAcceptanceRegistry", () => {
  const TOS_URL = "https://example.xyz/tos";

  async function deployFixture() {
    const [operator, otherAccount] = await ethers.getSigners();

    const { serviceConfiguration } = await deployServiceConfiguration();
    const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
      serviceConfiguration
    );

    return {
      tosAcceptanceRegistry,
      operator,
      otherAccount,
      serviceConfiguration
    };
  }

  describe("Deployment", async () => {
    it("terms of service URL is empty", async () => {
      const { tosAcceptanceRegistry } = await loadFixture(deployFixture);
      expect(await tosAcceptanceRegistry.termsOfService()).to.be.empty;
    });
  });

  describe("updateTermsOfService()", async () => {
    describe("Permissions", () => {
      it("can only be called by service operator", async () => {
        const { tosAcceptanceRegistry, operator, otherAccount } =
          await loadFixture(deployFixture);

        await expect(
          tosAcceptanceRegistry
            .connect(otherAccount)
            .updateTermsOfService(TOS_URL)
        ).to.be.revertedWith("ToS: not operator");

        await expect(
          tosAcceptanceRegistry.connect(operator).updateTermsOfService(TOS_URL)
        ).to.not.be.reverted;
      });
    });

    it("updates the stored terms of service", async () => {
      const { tosAcceptanceRegistry, operator } = await loadFixture(
        deployFixture
      );

      expect(await tosAcceptanceRegistry.termsOfService()).to.be.empty;
      await expect(
        tosAcceptanceRegistry.connect(operator).updateTermsOfService(TOS_URL)
      ).to.not.be.reverted;
      expect(await tosAcceptanceRegistry.termsOfService()).to.equal(TOS_URL);
    });

    it("emits and event when the ToS URL is updated", async () => {
      const { tosAcceptanceRegistry, operator } = await loadFixture(
        deployFixture
      );

      await expect(
        tosAcceptanceRegistry.connect(operator).updateTermsOfService("test1")
      ).to.emit(tosAcceptanceRegistry, "TermsOfServiceUpdated");
    });
  });

  describe("acceptTermsOfService()", async () => {
    it("reverts if ToS haven't been set", async () => {
      const { tosAcceptanceRegistry, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(
        tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService()
      ).to.be.revertedWith("ToS: not set");
    });

    it("records acceptance record", async () => {
      const { tosAcceptanceRegistry, operator, otherAccount } =
        await loadFixture(deployFixture);
      expect(await tosAcceptanceRegistry.hasAccepted(otherAccount.address)).to
        .be.false;

      // Set the terms, so we can start recording acceptances
      await tosAcceptanceRegistry
        .connect(operator)
        .updateTermsOfService("test1");

      await expect(
        tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService()
      )
        .to.emit(tosAcceptanceRegistry, "AcceptanceRecorded")
        .withArgs(otherAccount.address);

      // Acceptance should be recorded
      expect(await tosAcceptanceRegistry.hasAccepted(otherAccount.address)).to
        .be.true;
    });
  });
});
