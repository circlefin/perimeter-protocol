import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

async function main() {
  const [admin, operator, deployer, pauser] = await ethers.getSigners();

  // This will be the Pool Admin
  const poolAdmin = new hre.ethers.Wallet("");
  const lender = new hre.ethers.Wallet("");
  const borrower = new hre.ethers.Wallet("");

  let tx;

  // One-time setup of PoolAdminAccessControl
  const poolAdminAccessControlAddress = "";
  const credentialSchema = "";
  const trustedVerifier = "";

  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl",
    admin
  );
  const poolAdminAccessControl = PoolAdminAccessControl.attach(
    poolAdminAccessControlAddress
  );

  tx = await poolAdminAccessControl.addCredentialSchema(credentialSchema);
  tx = await poolAdminAccessControl.addTrustedVerifier(trustedVerifier);

  // Accept TOS
  const tosAcceptanceRegistryAddress = "";
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = ToSAcceptanceRegistry.attach(
    tosAcceptanceRegistryAddress
  ).connect(poolAdmin);

  tx = await tosAcceptanceRegistry.acceptTermsOfService();
  await tx.wait();
  console.log("Accepted TOS");

  // Verify Pool Admin
  const verificationResult = {
    schema: "",
    subject: "",
    expiration: 0,
    verifier_verification_id: ""
  };
  const signature = "";

  await poolAdminAccessControl
    .connect(wallet)
    .verify(verificationResult, signature);

  // Verify Pool Lender/Borrower
  const poolAccessControlAddress = "";

  const PoolAccessControl = await ethers.getContractFactory(
    "PoolAccessControl",
    admin
  );
  const poolAccessControl = PoolAccessControl.attach(poolAccessControlAddress);
  const verificationResult2 = {
    schema: "",
    subject: "",
    expiration: 0,
    verifier_verification_id: ""
  };
  const signature2 = "";

  await poolAccessControl
  .connect(wallet2)
  .verify(verificationResult2., signature2)


  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
