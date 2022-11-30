import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPermissionedPool } from "../support/pool";
import { getSignedVerificationResult } from "../support/verite";

describe("PoolAccessControl", () => {
  async function deployFixture() {
    const [operator, poolAdmin, verifier, poolParticipant, ...otherAccounts] =
      await ethers.getSigners();
    const { pool, tosAcceptanceRegistry } = await deployPermissionedPool({
      operator,
      poolAdmin
    });

    await tosAcceptanceRegistry.updateTermsOfService("http://circle.com");

    // Deploy the PermissionedPoolFactory contract
    const PoolAccessControl = await ethers.getContractFactory(
      "PoolAccessControl"
    );
    const poolAccessControl = await PoolAccessControl.deploy(
      pool.address,
      tosAcceptanceRegistry.address
    );
    await poolAccessControl.deployed();

    return {
      poolAdmin,
      verifier,
      poolParticipant,
      otherAccounts,
      poolAccessControl,
      tosAcceptanceRegistry
    };
  }

  describe("isValidParticipant()", () => {
    it("returns false if the address is not on the allow list and has not verified via Verite", async () => {
      const { poolAccessControl, poolParticipant } = await loadFixture(
        deployFixture
      );

      expect(
        await poolAccessControl.isValidParticipant(poolParticipant.address)
      ).to.equal(false);
    });

    it("returns true if the address is on the allow list", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      await poolAccessControl
        .connect(poolAdmin)
        .allowParticipant(poolParticipant.address);

      expect(
        await poolAccessControl.isValidParticipant(poolParticipant.address)
      ).to.equal(true);
    });

    it("returns true if the address has been verified via Verite", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      // Register the verifier
      await poolAccessControl
        .connect(poolAdmin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await poolAccessControl
        .connect(poolParticipant)
        .verify(verificationResult, signature);

      expect(
        await poolAccessControl.isValidParticipant(poolParticipant.address)
      ).to.equal(true);
    });

    it("returns false if the participant was approved by Verite but the verification expired", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      // Register the verifier
      await poolAccessControl
        .connect(poolAdmin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await poolAccessControl
        .connect(poolParticipant)
        .verify(verificationResult, signature);

      expect(
        await poolAccessControl.isValidParticipant(poolParticipant.address)
      ).to.equal(true);

      await time.increaseTo(verificationResult.expiration + 1);

      expect(
        await poolAccessControl.isValidParticipant(poolParticipant.address)
      ).to.equal(false);
    });
  });

  describe("allowParticipant()", () => {
    it("requires the participant agreed to the ToS", async () => {
      const { poolAccessControl, poolAdmin, poolParticipant } =
        await loadFixture(deployFixture);

      await expect(
        poolAccessControl
          .connect(poolAdmin)
          .allowParticipant(poolParticipant.address)
      ).to.be.revertedWith("Pool: participant not accepted ToS");
    });

    it("adds a new participant", async () => {
      const {
        poolAccessControl,
        poolAdmin,
        poolParticipant,
        tosAcceptanceRegistry
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      await expect(
        poolAccessControl
          .connect(poolAdmin)
          .allowParticipant(poolParticipant.address)
      )
        .to.emit(poolAccessControl, "ParticipantAllowed")
        .withArgs(poolParticipant.address);
    });
  });

  describe("removeParticipant()", () => {
    it("removes a participant", async () => {
      const { poolAccessControl, poolAdmin, poolParticipant } =
        await loadFixture(deployFixture);

      await expect(
        poolAccessControl
          .connect(poolAdmin)
          .removeParticipant(poolParticipant.address)
      )
        .to.emit(poolAccessControl, "ParticipantRemoved")
        .withArgs(poolParticipant.address);
    });
  });

  describe("addTrustedVerifier()", () => {
    it("adds a new verifier", async () => {
      const { poolAccessControl, poolAdmin, verifier } = await loadFixture(
        deployFixture
      );

      await expect(
        poolAccessControl
          .connect(poolAdmin)
          .addTrustedVerifier(verifier.address)
      )
        .to.emit(poolAccessControl, "TrustedVerifierAdded")
        .withArgs(verifier.address);
    });
  });

  describe("removeTrustedVerifier()", () => {
    it("removes a verifier", async () => {
      const { poolAccessControl, poolAdmin, verifier } = await loadFixture(
        deployFixture
      );

      await expect(
        poolAccessControl
          .connect(poolAdmin)
          .removeTrustedVerifier(verifier.address)
      )
        .to.emit(poolAccessControl, "TrustedVerifierRemoved")
        .withArgs(verifier.address);
    });
  });

  describe("addCredentialSchema()", () => {
    it("adds a new verifier", async () => {
      const { poolAccessControl, poolAdmin } = await loadFixture(deployFixture);

      await expect(
        poolAccessControl.connect(poolAdmin).addCredentialSchema("schema://kyc")
      )
        .to.emit(poolAccessControl, "CredentialSchemaAdded")
        .withArgs("schema://kyc");
    });
  });

  describe("removeCredentialSchema()", () => {
    it("removes a verifier", async () => {
      const { poolAccessControl, poolAdmin } = await loadFixture(deployFixture);

      await expect(
        poolAccessControl
          .connect(poolAdmin)
          .removeCredentialSchema("schema://kyc")
      )
        .to.emit(poolAccessControl, "CredentialSchemaRemoved")
        .withArgs("schema://kyc");
    });
  });

  describe("verify()", () => {
    it("reverts if the subject has not accepted ToS", async () => {
      const { poolAccessControl, poolParticipant, verifier, poolAdmin } =
        await loadFixture(deployFixture);

      // Register the verifier
      await poolAccessControl
        .connect(poolAdmin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl
          .connect(poolParticipant)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("MISSING_TOS_ACCEPTANCE");
    });

    it("reverts if the schema is not supported", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      // Register the verifier
      await poolAccessControl
        .connect(poolAdmin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier
        );

      // Verify the verification result
      await expect(
        poolAccessControl
          .connect(poolParticipant)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("INVALID_CREDENTIAL_SCHEMA");
    });

    it("reverts if the expiration is in the past", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      // Register the verifier
      await poolAccessControl
        .connect(poolAdmin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier,
          { expiration: (await time.latest()) - 100 }
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl
          .connect(poolParticipant)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("VERIFICATION_RESULT_EXPIRED");
    });

    it("reverts if it is verified by an unsupported verifier", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl
          .connect(poolParticipant)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("INVALID_SIGNER");
    });

    it("passes if given a valid verification from a trusted verifier", async () => {
      const {
        poolAccessControl,
        poolParticipant,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry
        .connect(poolParticipant)
        .acceptTermsOfService();

      // Register the verifier
      await poolAccessControl
        .connect(poolAdmin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          poolParticipant.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl
          .connect(poolParticipant)
          .verify(verificationResult, signature)
      )
        .to.emit(poolAccessControl, "VerificationResultConfirmed")
        .withArgs(poolParticipant.address);
    });
  });
});
