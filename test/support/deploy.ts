import { ethers } from "hardhat";

/**
 * Deploy a new ServiceConfiguration contract with all associated contracts,
 * such as PoolManagerAccessControl
 */
export const deployServiceConfiguration = async (
  operator: ethers.SignerWithAddress
) => {
  /**
   * Deploy the Service Configuration contract
   */
  const ServiceConfiguration = await ethers.getContractFactory(
    "ServiceConfiguration",
    operator
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();

  /**
   * Deploy the PoolManagerAccessControl contract
   */
  const PoolManagerAccessControl = await ethers.getContractFactory(
    "PoolManagerAccessControl"
  );
  const poolManagerAccessControl = await PoolManagerAccessControl.deploy(
    serviceConfiguration.address
  );
  await poolManagerAccessControl.deployed();

  /**
   * Set the poolManagerAccessControl address in the serviceConfiguration contract
   */
  serviceConfiguration.setPoolManagerAccessControl(
    poolManagerAccessControl.address
  );

  return {
    serviceConfiguration,
    poolManagerAccessControl
  };
};
