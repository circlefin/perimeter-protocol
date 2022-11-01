import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployPermissionedPool } from "../support/pool";
import { getSignedVerificationResult } from "../support/verite";

describe("PoolAccessControl", () => {
  async function deployFixture() {
    const [operator, poolAdmin, verifier, lender, ...otherAccounts] =
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
      lender,
      otherAccounts,
      poolAccessControl,
      tosAcceptanceRegistry
    };
  }

  describe("isValidLender()", () => {
    it("returns false if the address is not on the allow list and has not verified via Verite", async () => {
      const { poolAccessControl, lender } = await loadFixture(deployFixture);

      expect(await poolAccessControl.isValidLender(lender.address)).to.equal(
        false
      );
    });

    it("returns true if the address is on the allow list", async () => {
      const { poolAccessControl, lender, tosAcceptanceRegistry, poolAdmin } =
        await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      await poolAccessControl.connect(poolAdmin).allowLender(lender.address);

      expect(await poolAccessControl.isValidLender(lender.address)).to.equal(
        true
      );
    });

    it("returns true if the address has been verified via Verite", async () => {
      const {
        poolAccessControl,
        lender,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      // Register the verifier
      await poolAccessControl.connect(poolAdmin).addVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addSchema(verificationResult.schema);

      // Verify the verification result
      await poolAccessControl
        .connect(lender)
        .verify(verificationResult, signature);

      expect(await poolAccessControl.isValidLender(lender.address)).to.equal(
        true
      );
    });

    it("returns false if the lender was approved by Verite but the verification expired", async () => {
      const {
        poolAccessControl,
        lender,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      // Register the verifier
      await poolAccessControl.connect(poolAdmin).addVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addSchema(verificationResult.schema);

      // Verify the verification result
      await poolAccessControl
        .connect(lender)
        .verify(verificationResult, signature);

      expect(await poolAccessControl.isValidLender(lender.address)).to.equal(
        true
      );

      await time.increaseTo(verificationResult.expiration + 1);

      expect(await poolAccessControl.isValidLender(lender.address)).to.equal(
        false
      );
    });
  });

  describe("allowLender()", () => {
    it("requires the lender agreed to the ToS", async () => {
      const { poolAccessControl, poolAdmin, lender } = await loadFixture(
        deployFixture
      );

      await expect(
        poolAccessControl.connect(poolAdmin).allowLender(lender.address)
      ).to.be.revertedWith("Pool: lender not accepted ToS");
    });

    it("adds a new lender", async () => {
      const { poolAccessControl, poolAdmin, lender, tosAcceptanceRegistry } =
        await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      await expect(
        poolAccessControl.connect(poolAdmin).allowLender(lender.address)
      )
        .to.emit(poolAccessControl, "LenderAllowed")
        .withArgs(lender.address);
    });
  });

  describe("removeLender()", () => {
    it("removes a lender", async () => {
      const { poolAccessControl, poolAdmin, lender } = await loadFixture(
        deployFixture
      );

      await expect(
        poolAccessControl.connect(poolAdmin).removeLender(lender.address)
      )
        .to.emit(poolAccessControl, "LenderRemoved")
        .withArgs(lender.address);
    });
  });

  describe("addVerifier()", () => {
    it("adds a new verifier", async () => {
      const { poolAccessControl, poolAdmin, verifier } = await loadFixture(
        deployFixture
      );

      await expect(
        poolAccessControl.connect(poolAdmin).addVerifier(verifier.address)
      )
        .to.emit(poolAccessControl, "VerifierAdded")
        .withArgs(verifier.address);
    });
  });

  describe("removeVerifier()", () => {
    it("removes a verifier", async () => {
      const { poolAccessControl, poolAdmin, verifier } = await loadFixture(
        deployFixture
      );

      await expect(
        poolAccessControl.connect(poolAdmin).removeVerifier(verifier.address)
      )
        .to.emit(poolAccessControl, "VerifierRemoved")
        .withArgs(verifier.address);
    });
  });

  describe("addSchema()", () => {
    it("adds a new verifier", async () => {
      const { poolAccessControl, poolAdmin } = await loadFixture(deployFixture);

      await expect(
        poolAccessControl.connect(poolAdmin).addSchema("schema://kyc")
      )
        .to.emit(poolAccessControl, "CredentialSchemaAdded")
        .withArgs("schema://kyc");
    });
  });

  describe("removeSchema()", () => {
    it("removes a verifier", async () => {
      const { poolAccessControl, poolAdmin } = await loadFixture(deployFixture);

      await expect(
        poolAccessControl.connect(poolAdmin).removeSchema("schema://kyc")
      )
        .to.emit(poolAccessControl, "CredentialSchemaRemoved")
        .withArgs("schema://kyc");
    });
  });

  describe("verify()", () => {
    it("reverts if the subject has not accepted ToS", async () => {
      const { poolAccessControl, lender, verifier, poolAdmin } =
        await loadFixture(deployFixture);

      // Register the verifier
      await poolAccessControl.connect(poolAdmin).addVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl.connect(lender).verify(verificationResult, signature)
      ).to.be.revertedWith("PoolAccessControl: subject not accepted ToS");
    });

    it("reverts if the schema is not supported", async () => {
      const {
        poolAccessControl,
        lender,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      // Register the verifier
      await poolAccessControl.connect(poolAdmin).addVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier
        );

      // Verify the verification result
      await expect(
        poolAccessControl.connect(lender).verify(verificationResult, signature)
      ).to.be.revertedWith("PoolAccessControl: unsupported credential schema");
    });

    it("reverts if the expiration is in the past", async () => {
      const {
        poolAccessControl,
        lender,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      // Register the verifier
      await poolAccessControl.connect(poolAdmin).addVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier,
          { expiration: (await time.latest()) - 100 }
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl.connect(lender).verify(verificationResult, signature)
      ).to.be.revertedWith("PoolAccessControl: Verification result expired");
    });

    it("reverts if it is verified by an unsupported verifier", async () => {
      const {
        poolAccessControl,
        lender,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl.connect(lender).verify(verificationResult, signature)
      ).to.be.revertedWith(
        "PoolAccessControl: Signed digest cannot be verified"
      );
    });

    it("passes if given a valid verification from a trusted verifier", async () => {
      const {
        poolAccessControl,
        lender,
        verifier,
        tosAcceptanceRegistry,
        poolAdmin
      } = await loadFixture(deployFixture);

      await tosAcceptanceRegistry.connect(lender).acceptTermsOfService();

      // Register the verifier
      await poolAccessControl.connect(poolAdmin).addVerifier(verifier.address);

      // Get a signed verification result
      const { verificationResult, signature } =
        await getSignedVerificationResult(
          poolAccessControl.address,
          lender.address,
          verifier
        );

      // Register the schema
      await poolAccessControl
        .connect(poolAdmin)
        .addSchema(verificationResult.schema);

      // Verify the verification result
      await expect(
        poolAccessControl.connect(lender).verify(verificationResult, signature)
      )
        .to.emit(poolAccessControl, "VerificationResultConfirmed")
        .withArgs(lender.address);
    });
  });
});
