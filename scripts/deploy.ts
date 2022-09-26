import { ethers } from "hardhat";

async function main() {
  const ServiceConfiguration = await ethers.getContractFactory(
    "ServiceConfiguration"
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();

  console.log(
    `ServiceConfiguration deployed to ${serviceConfiguration.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
