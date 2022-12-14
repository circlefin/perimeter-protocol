import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

async function main() {
  // Address of the ToSAcceptanceRegistry contract
  const tosAcceptanceRegistryAddress =
    "0x15B0d52d980b58c48c90A479B37e3B93a9bBEd16";
  // Address of the PoolAdminAccessControl contract
  const poolAdminAccessControlAddress =
    "0x801a90094605123D55A8ea022dB623b6249c2b76";
  // The VerificationResult and signature from a Verite verifier. You can run the script
  // `verite-verify` to get your own results
  const verificationResult = {
    schema: [
      "https://verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person"
    ],
    subject: "",
    expiration: 1671133884,
    verifier_verification_id: ""
  };
  const signature = "";

  const [admin, operator, deployer, pauser, other] =
    await hre.ethers.getSigners();

  let tx;

  // Accept TOS
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = ToSAcceptanceRegistry.attach(
    tosAcceptanceRegistryAddress
  ).connect(other);

  tx = await tosAcceptanceRegistry.acceptTermsOfService();
  await tx.wait();
  console.log("Accepted TOS");

  // Verify with Verite
  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl"
  );
  const poolAdminAccessControl = PoolAdminAccessControl.attach(
    poolAdminAccessControlAddress
  );

  tx = await poolAdminAccessControl
    .connect(other)
    .verify(verificationResult, signature);
  await tx.wait();
  console.log("Verified!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
