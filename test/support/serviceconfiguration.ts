import { ethers } from "hardhat";
import { deployToSAcceptanceRegistry } from "./tosacceptanceregistry";

/**
 * Deploy ServiceConfiguration
 */
export async function deployServiceConfiguration(operator?: any) {
  const ServiceConfiguration = await ethers.getContractFactory(
    "ServiceConfiguration",
    operator
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();

  return {
    serviceConfiguration
  };
}

/**
 * Deploy PermissionedServiceConfiguration
 */
export async function deployPermissionedServiceConfiguration(operator: any) {
  const ServiceConfiguration = await ethers.getContractFactory(
    "PermissionedServiceConfiguration",
    operator
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();

  const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
    serviceConfiguration
  );
  await tosAcceptanceRegistry
    .connect(operator)
    .updateTermsOfService("https://terms.xyz");

  await serviceConfiguration
    .connect(operator)
    .setToSAcceptanceRegistry(tosAcceptanceRegistry.address);

  const PoolManagerAccessControl = await ethers.getContractFactory(
    "PoolManagerAccessControl"
  );
  const poolManagerAccessControl = await PoolManagerAccessControl.deploy(
    serviceConfiguration.address
  );
  await poolManagerAccessControl.deployed();

  await serviceConfiguration
    .connect(operator)
    .setPoolManagerAccessControl(poolManagerAccessControl.address);

  return {
    serviceConfiguration,
    tosAcceptanceRegistry,
    poolManagerAccessControl
  };
}
