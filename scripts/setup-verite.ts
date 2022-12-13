import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

async function main() {
  const [admin, operator, deployer, pauser, poolAdmin] =
    await ethers.getSigners();

  let tx;

  // One-time setup of PoolAdminAccessControl
  const poolAdminAccessControlAddress =
    "0x3b380e8d02A068ae779b73c7E24c2d18a176BbAD";
  const credentialSchema =
    "https://verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person";
  const trustedVerifier = "0xeb45ca911a2b481dEAdE649486ec77E9907F7e12";

  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl"
  );
  const poolAdminAccessControl = PoolAdminAccessControl.attach(
    poolAdminAccessControlAddress
  ).attach(poolAdminAccessControlAddress);

  tx = await poolAdminAccessControl
    .connect(operator)
    .addCredentialSchema(credentialSchema);
  await tx.wait();
  console.log("Added credential schema");
  tx = await poolAdminAccessControl
    .connect(operator)
    .addTrustedVerifier(trustedVerifier);
  await tx.wait();
  console.log("Added trusted verifier");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
