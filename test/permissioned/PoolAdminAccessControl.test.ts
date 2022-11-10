import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployToSAcceptanceRegistry } from "../support/tosacceptanceregistry";

describe("PoolAdminAccessControl", () => {
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

    const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
      serviceConfiguration
    );
    await tosAcceptanceRegistry.updateTermsOfService("https://terms.xyz");
    await serviceConfiguration.setToSAcceptanceRegistry(
      tosAcceptanceRegistry.address
    );

    // Deploy the PoolAdminAccessControl contract
    const PoolAdminAccessControl = await ethers.getContractFactory(
      "PoolAdminAccessControl"
    );
    const poolAdminAccessControl = await PoolAdminAccessControl.deploy(
      serviceConfiguration.address
    );
    await poolAdminAccessControl.deployed();

    return {
      poolAdminAccessControl,
      otherAccount,
      tosAcceptanceRegistry
    };
  }

  describe("isAllowed()", () => {
    it("returns false if the address is not in the allow list", async () => {
      const { poolAdminAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("returns true if the address is on the allow list", async () => {
      const { poolAdminAccessControl, otherAccount, tosAcceptanceRegistry } =
        await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService();
      await poolAdminAccessControl.allow(otherAccount.address);

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });
  });

  describe("allow()", () => {
    it("reverts when adding an address to the allowList if they haven't accepted ToS", async () => {
      const { poolAdminAccessControl, otherAccount, tosAcceptanceRegistry } =
        await loadFixture(deployFixture);

      // No ToS acceptance
      expect(await tosAcceptanceRegistry.hasAccepted(otherAccount.address)).to
        .be.false;

      await expect(
        poolAdminAccessControl.allow(otherAccount.address)
      ).to.be.revertedWith("Pool: no ToS acceptance recorded");
    });

    it("adds an address to the allowList if they have accepted the ToS", async () => {
      const { poolAdminAccessControl, otherAccount, tosAcceptanceRegistry } =
        await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService();
      expect(await tosAcceptanceRegistry.hasAccepted(otherAccount.address)).to
        .be.true;

      await poolAdminAccessControl.allow(otherAccount.address);

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    it("succeeds if the address is already in the allowList", async () => {
      const { poolAdminAccessControl, otherAccount, tosAcceptanceRegistry } =
        await loadFixture(deployFixture);
      await tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService();

      await poolAdminAccessControl.allow(otherAccount.address);
      await poolAdminAccessControl.allow(otherAccount.address);

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolAdminAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolAdminAccessControl
            .connect(otherAccount)
            .allow(otherAccount.getAddress())
        ).to.be.revertedWith("caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon adding an address", async () => {
        const { poolAdminAccessControl, otherAccount, tosAcceptanceRegistry } =
          await loadFixture(deployFixture);
        await tosAcceptanceRegistry
          .connect(otherAccount)
          .acceptTermsOfService();

        expect(await poolAdminAccessControl.allow(otherAccount.address))
          .to.emit(poolAdminAccessControl, "AllowListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("remove()", () => {
    it("removes an address from the allowList", async () => {
      const { poolAdminAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolAdminAccessControl.remove(otherAccount.address);
      await poolAdminAccessControl.remove(otherAccount.address);

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("returns false if the address is not in the allowList", async () => {
      const { poolAdminAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolAdminAccessControl.remove(otherAccount.address);

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolAdminAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolAdminAccessControl
            .connect(otherAccount)
            .remove(otherAccount.getAddress())
        ).to.be.revertedWith("caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon removing an address", async () => {
        const { poolAdminAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolAdminAccessControl.remove(otherAccount.address);

        await expect(poolAdminAccessControl.remove(otherAccount.address))
          .to.emit(poolAdminAccessControl, "AllowListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });
});
