import { ethers } from "hardhat";

/**
 * Deploy TermsOfServiceConsentRegistry
 */
export async function deployToSConsentRegistry(serviceConfig: any) {
  const TermsOfServiceConsentRegistry = await ethers.getContractFactory(
    "TermsOfServiceConsentRegistry"
  );
  const termsOfServiceConsentRegistry =
    await TermsOfServiceConsentRegistry.deploy(serviceConfig.address);
  await termsOfServiceConsentRegistry.deployed();

  return {
    termsOfServiceConsentRegistry
  };
}
