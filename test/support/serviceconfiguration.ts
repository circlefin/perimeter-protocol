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

  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl"
  );
  const poolAdminAccessControl = await PoolAdminAccessControl.deploy(
    serviceConfiguration.address
  );
  await poolAdminAccessControl.deployed();

  await serviceConfiguration
    .connect(operator)
    .setPoolAdminAccessControl(poolAdminAccessControl.address);

  return {
    serviceConfiguration,
    tosAcceptanceRegistry,
    poolAdminAccessControl
  };
}
