import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Inputs
  const tosAcceptanceRegistryAddress =
    "0x6addaAb8e60a3dd45Aa9181fA8c6131dF90104fa";

  const [admin, operator, deployer, pauser, other] =
    await hre.ethers.getSigners();

  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = ToSAcceptanceRegistry.attach(
    tosAcceptanceRegistryAddress
  ).connect(other);

  const tx = await tosAcceptanceRegistry.acceptTermsOfService();
  await tx.wait();
  console.log("Accepted TOS");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
