import { ethers, upgrades } from "hardhat";
import { deployToSAcceptanceRegistry } from "./tosacceptanceregistry";
import { getCommonSigners } from "./utils";

/**
 * Deploy ServiceConfiguration
 */
export async function deployServiceConfiguration() {
  const { admin, operator, deployer, pauser } = await getCommonSigners();
  const ServiceConfiguration = await ethers.getContractFactory(
    "ServiceConfiguration",
    admin
  );
  const serviceConfiguration = await upgrades.deployProxy(
    ServiceConfiguration,
    { kind: "uups" }
  );
  await serviceConfiguration.deployed();
  await serviceConfiguration
    .connect(admin)
    .grantRole(await serviceConfiguration.OPERATOR_ROLE(), operator.address);

  await serviceConfiguration
    .connect(admin)
    .grantRole(await serviceConfiguration.DEPLOYER_ROLE(), deployer.address);

  await serviceConfiguration
    .connect(admin)
    .grantRole(await serviceConfiguration.PAUSER_ROLE(), pauser.address);

  return {
    serviceConfiguration
  };
}

/**
 * Deploy PermissionedServiceConfiguration
 */
export async function deployPermissionedServiceConfiguration() {
  const { admin, operator, deployer, pauser } = await getCommonSigners();

  const ServiceConfiguration = await ethers.getContractFactory(
    "PermissionedServiceConfiguration",
    admin
  );
  const serviceConfiguration = await upgrades.deployProxy(
    ServiceConfiguration,
    { kind: "uups" }
  );
  await serviceConfiguration.deployed();

  // Grant operator
  await serviceConfiguration
    .connect(admin)
    .grantRole(await serviceConfiguration.OPERATOR_ROLE(), operator.address);

  await serviceConfiguration
    .connect(admin)
    .grantRole(await serviceConfiguration.DEPLOYER_ROLE(), deployer.address);

  await serviceConfiguration
    .connect(admin)
    .grantRole(await serviceConfiguration.PAUSER_ROLE(), pauser.address);

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
  const poolAdminAccessControl = await upgrades.deployProxy(
    PoolAdminAccessControl,
    [serviceConfiguration.address],
    { kind: "uups" }
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
