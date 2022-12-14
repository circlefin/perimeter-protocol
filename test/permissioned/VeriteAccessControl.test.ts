import { ethers, upgrades } from "hardhat";
import { getSignedVerificationResult } from "../support/verite";
import { expect } from "chai";

describe("VeriteAccessControl", () => {
  async function deployFixture() {
    const [verifier, admin, subject, otherSubject] = await ethers.getSigners();

    const VeriteAccessControl = await ethers.getContractFactory(
      "MockVeriteAccessControl"
    );
    const veriteAccessControl = await upgrades.deployProxy(
      VeriteAccessControl,
      { kind: "uups" }
    );
    await veriteAccessControl.deployed();

    return {
      veriteAccessControl,
      verifier,
      admin,
      subject,
      otherSubject
    };
  }

  describe("verify()", () => {
    it("succeeds when given a valid verification result from a trusted verifier", async () => {
      const { veriteAccessControl, verifier, admin, subject } =
        await deployFixture();

      // Register the verifier
      await veriteAccessControl
        .connect(admin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          veriteAccessControl.address,
          subject.address,
          verifier
        );

      // Register the schema
      await veriteAccessControl
        .connect(admin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        veriteAccessControl
          .connect(subject)
          .verify(verificationResult, signature)
      )
        .to.emit(veriteAccessControl, "VerificationResultConfirmed")
        .withArgs(subject.address);
    });

    it("reverts if the verifier is not trusted", async () => {
      const { veriteAccessControl, verifier, admin, subject } =
        await deployFixture();

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          veriteAccessControl.address,
          subject.address,
          verifier
        );

      // Register the schema
      await veriteAccessControl
        .connect(admin)
        .addCredentialSchema(verificationResult.schema);
      await expect(
        veriteAccessControl
          .connect(subject)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("INVALID_SIGNER");
    });

    it("reverts if the schema is not valid", async () => {
      const { veriteAccessControl, verifier, admin, subject } =
        await deployFixture();

      // Register the verifier
      await veriteAccessControl
        .connect(admin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          veriteAccessControl.address,
          subject.address,
          verifier
        );

      // Verify the verification result
      await expect(
        veriteAccessControl
          .connect(subject)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("INVALID_SCHEMA");
    });

    it("reverts if the result is expired", async () => {
      const { veriteAccessControl, verifier, admin, subject } =
        await deployFixture();

      // Register the verifier
      await veriteAccessControl
        .connect(admin)
        .addTrustedVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          veriteAccessControl.address,
          subject.address,
          verifier,
          { expiration: 0 }
        );

      // Register the schema
      await veriteAccessControl
        .connect(admin)
        .addCredentialSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        veriteAccessControl
          .connect(subject)
          .verify(verificationResult, signature)
      ).to.be.revertedWith("VERIFICATION_RESULT_EXPIRED");
    });
  });
});
