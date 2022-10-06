import { ethers } from "hardhat";

/**
 * Deploy ServiceConfiguration
 */
export async function deployServiceConfiguration() {
  const ServiceConfiguration = await ethers.getContractFactory(
    "ServiceConfiguration"
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();

  return {
    serviceConfiguration
  };
}
