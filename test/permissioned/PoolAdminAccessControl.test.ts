import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployToSAcceptanceRegistry } from "../support/tosacceptanceregistry";
import { performVeriteVerification } from "../support/verite";

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
      operator,
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
      const {
        operator,
        poolAdminAccessControl,
        otherAccount,
        tosAcceptanceRegistry
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService();
      await performVeriteVerification(
        poolAdminAccessControl,
        operator,
        otherAccount
      );

      expect(
        await poolAdminAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });
  });

  describe("allow()", () => {
    it("reverts when verifying if they haven't accepted ToS", async () => {
      const {
        operator,
        poolAdminAccessControl,
        otherAccount,
        tosAcceptanceRegistry
      } = await loadFixture(deployFixture);

      // No ToS acceptance
      expect(await tosAcceptanceRegistry.hasAccepted(otherAccount.address)).to
        .be.false;

      await expect(
        performVeriteVerification(
          poolAdminAccessControl,
          operator,
          otherAccount
        )
      ).to.be.revertedWith("MISSING_TOS_ACCEPTANCE");
    });

    it("succeeds if they have accepted the ToS", async () => {
      const {
        operator,
        poolAdminAccessControl,
        otherAccount,
        tosAcceptanceRegistry
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(otherAccount).acceptTermsOfService();
      expect(await tosAcceptanceRegistry.hasAccepted(otherAccount.address)).to
        .be.true;

      await expect(
        performVeriteVerification(
          poolAdminAccessControl,
          operator,
          otherAccount
        )
      ).not.to.be.reverted;
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolAdminAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          performVeriteVerification(
            poolAdminAccessControl,
            otherAccount,
            otherAccount
          )
        ).to.be.revertedWith("CALLER_NOT_OPERATOR");
      });
    });

    describe("events", () => {
      it("emits an VerificationResultConfirmed event upon verifying an address", async () => {
        const {
          operator,
          poolAdminAccessControl,
          otherAccount,
          tosAcceptanceRegistry
        } = await loadFixture(deployFixture);
        await tosAcceptanceRegistry
          .connect(otherAccount)
          .acceptTermsOfService();

        expect(
          await performVeriteVerification(
            poolAdminAccessControl,
            operator,
            otherAccount
          )
        )
          .to.emit(poolAdminAccessControl, "VerificationResultConfirmed")
          .withArgs(otherAccount.address, true);
      });
    });
  });
});
