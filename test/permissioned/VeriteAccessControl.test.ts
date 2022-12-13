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

  describe("verite", () => {
    it("can integrate with Circle's verifier", async () => {
      const signature =
        "0xdde978e9c777fbcc995b93520e96dc0e73826b7cdead39740652db3bb8950ed55c20a4a5d3b4bd4bb739f665d5bcff473a5b8f3cc7392a10220fa2294a81e2561b";
      const expiration = 1671038498;

      const domain = {
        name: "VerificationRegistry",
        version: "1.0",
        chainId: 5,
        verifyingContract: "0x3b380e8d02A068ae779b73c7E24c2d18a176BbAD"
      };
      const types = {
        VerificationResult: [
          { name: "schema", type: "string" },
          { name: "subject", type: "address" },
          { name: "expiration", type: "uint256" },
          { name: "verifier_verification_id", type: "string" }
        ]
      };
      const verificationResult = {
        schema:
          "https://verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person",
        subject: "0x9f5caad8169dea4c4a7cd9be64a1f473d56409a0",
        expiration: expiration,
        verifier_verification_id: "7e1d8658-c18d-4eb8-bb02-828d9989752f"
      };

      const recoveredAddress = ethers.utils.verifyTypedData(
        domain,
        types,
        verificationResult,
        signature
      );

      expect(recoveredAddress).to.equal(
        "0xeb45ca911a2b481dEAdE649486ec77E9907F7e12"
      );
    });
  });
});
