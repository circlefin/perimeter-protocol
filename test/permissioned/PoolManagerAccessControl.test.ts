import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployToSConsentRegistry } from "../support/tosconsentregistry";

describe("PoolManagerAccessControl", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, otherAccount] = await ethers.getSigners();

    // Deploy the Service Configuration contract
    const ServiceConfiguration = await ethers.getContractFactory(
      "ServiceConfiguration",
      operator
    );
    const serviceConfiguration = await ServiceConfiguration.deploy();
    await serviceConfiguration.deployed();

    const { termsOfServiceConsentRegistry } = await deployToSConsentRegistry(
      serviceConfiguration
    );
    await termsOfServiceConsentRegistry.updateTermsOfService(
      "https://terms.xyz"
    );
    await serviceConfiguration.setTermsOfServiceConsentRegistry(
      termsOfServiceConsentRegistry.address
    );

    // Deploy the PoolManagerAccessControl contract
    const PoolManagerAccessControl = await ethers.getContractFactory(
      "PoolManagerAccessControl"
    );
    const poolManagerAccessControl = await PoolManagerAccessControl.deploy(
      serviceConfiguration.address
    );
    await poolManagerAccessControl.deployed();

    return {
      poolManagerAccessControl,
      otherAccount,
      termsOfServiceConsentRegistry
    };
  }

  describe("isAllowed()", () => {
    it("returns false if the address is not in the allow list", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("returns true if the address is on the allow list", async () => {
      const {
        poolManagerAccessControl,
        otherAccount,
        termsOfServiceConsentRegistry
      } = await loadFixture(deployFixture);

      await termsOfServiceConsentRegistry.connect(otherAccount).recordConsent();
      await poolManagerAccessControl.allow(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });
  });

  describe("allow()", () => {
    it("reverts when adding an address to the allowList if they haven't consented to ToS", async () => {
      const {
        poolManagerAccessControl,
        otherAccount,
        termsOfServiceConsentRegistry
      } = await loadFixture(deployFixture);

      // No ToS Consent
      expect(
        await termsOfServiceConsentRegistry.hasConsented(otherAccount.address)
      ).to.be.false;

      await expect(
        poolManagerAccessControl.allow(otherAccount.address)
      ).to.be.revertedWith("Pool: no ToS consent recorded");
    });

    it("adds an address to the allowList if they have consented to ToS", async () => {
      const {
        poolManagerAccessControl,
        otherAccount,
        termsOfServiceConsentRegistry
      } = await loadFixture(deployFixture);

      await termsOfServiceConsentRegistry.connect(otherAccount).recordConsent();
      expect(
        await termsOfServiceConsentRegistry.hasConsented(otherAccount.address)
      ).to.be.true;

      await poolManagerAccessControl.allow(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    it("succeeds if the address is already in the allowList", async () => {
      const {
        poolManagerAccessControl,
        otherAccount,
        termsOfServiceConsentRegistry
      } = await loadFixture(deployFixture);
      await termsOfServiceConsentRegistry.connect(otherAccount).recordConsent();
      await poolManagerAccessControl.allow(otherAccount.address);
      await poolManagerAccessControl.allow(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolManagerAccessControl
            .connect(otherAccount)
            .allow(otherAccount.getAddress())
        ).to.be.revertedWith("caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon adding an address", async () => {
        const {
          poolManagerAccessControl,
          otherAccount,
          termsOfServiceConsentRegistry
        } = await loadFixture(deployFixture);
        await termsOfServiceConsentRegistry
          .connect(otherAccount)
          .recordConsent();

        expect(await poolManagerAccessControl.allow(otherAccount.address))
          .to.emit(poolManagerAccessControl, "AllowListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("remove()", () => {
    it("removes an address from the allowList", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerAccessControl.remove(otherAccount.address);
      await poolManagerAccessControl.remove(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("returns false if the address is not in the allowList", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerAccessControl.remove(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolManagerAccessControl
            .connect(otherAccount)
            .remove(otherAccount.getAddress())
        ).to.be.revertedWith("caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon removing an address", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerAccessControl.remove(otherAccount.address);

        await expect(poolManagerAccessControl.remove(otherAccount.address))
          .to.emit(poolManagerAccessControl, "AllowListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });
});
