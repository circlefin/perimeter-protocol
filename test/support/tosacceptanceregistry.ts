import { ethers } from "hardhat";

/**
 * Deploy ToServiceAcceptanceRegistry
 */
export async function deployToSAcceptanceRegistry(serviceConfig: any) {
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = await ToSAcceptanceRegistry.deploy(
    serviceConfig.address
  );
  await tosAcceptanceRegistry.deployed();

  return {
    tosAcceptanceRegistry
  };
}
