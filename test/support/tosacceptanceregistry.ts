import { ethers, upgrades } from "hardhat";

/**
 * Deploy ToServiceAcceptanceRegistry
 */
export async function deployToSAcceptanceRegistry(serviceConfig: any) {
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = await upgrades.deployProxy(
    ToSAcceptanceRegistry,
    [serviceConfig.address],
    { kind: "uups" }
  );
  await tosAcceptanceRegistry.deployed();

  return {
    tosAcceptanceRegistry
  };
}
