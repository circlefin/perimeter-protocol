import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

async function main() {
  const [admin, operator, deployer, pauser, rachel] =
    await hre.ethers.getSigners();

  let tx;

  // Accept TOS
  const tosAcceptanceRegistryAddress =
    "0x7A7dC6070bAFd2C821607d9f33aC069Aa71331e3";
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = ToSAcceptanceRegistry.attach(
    tosAcceptanceRegistryAddress
  ).connect(rachel);

  tx = await tosAcceptanceRegistry.acceptTermsOfService();
  await tx.wait();
  console.log("Accepted TOS");

  // Verify with Verite
  const poolAdminAccessControlAddress =
    "0x3b380e8d02A068ae779b73c7E24c2d18a176BbAD";

  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl"
  );
  const poolAdminAccessControl = PoolAdminAccessControl.attach(
    poolAdminAccessControlAddress
  );

  const verificationResult = {
    schema:
      "https://verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person",
    subject: "0x9f5caad8169dea4c4a7cd9be64a1f473d56409a0",
    expiration: 1671038498,
    verifier_verification_id: "7e1d8658-c18d-4eb8-bb02-828d9989752f"
  };
  const signature =
    "0xdde978e9c777fbcc995b93520e96dc0e73826b7cdead39740652db3bb8950ed55c20a4a5d3b4bd4bb739f665d5bcff473a5b8f3cc7392a10220fa2294a81e2561b";
  tx = await poolAdminAccessControl
    .connect(rachel)
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
