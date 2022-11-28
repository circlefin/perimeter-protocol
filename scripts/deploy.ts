import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // The token we use for the liquidity asset must exist. If it is not defined, we'll deploy a mock token.
  let usdcAddress;
  if (process.env.USDC_ADDRESS) {
    usdcAddress = process.env.USDC_ADDRESS;
  } else {
    const Usdc = await ethers.getContractFactory("MockERC20");
    const usdc = await Usdc.deploy("USD Coin", "USDC", 6);
    await usdc.deployed();
    console.log(`Deployed mock USDC token to ${usdc.address}`);
    usdcAddress = usdc.address;
  }

  // Deploy ServiceConfiguration
  const ServiceConfiguration = await ethers.getContractFactory(
    "PermissionedServiceConfiguration"
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();
  console.log(
    `PermissionedServiceConfiguration deployed to ${serviceConfiguration.address}`
  );

  // Set USDC as a liquidity asset for the protocol
  await serviceConfiguration.setLiquidityAsset(usdcAddress, true);
  console.log(`Updated ServiceConfiguration to add USDC as a liquidity asset`);

  // Deploy ToSAcceptanceRegistry
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const toSAcceptanceRegistry = await ToSAcceptanceRegistry.deploy(
    serviceConfiguration.address
  );
  await toSAcceptanceRegistry.deployed();
  console.log(
    `ToSAcceptanceRegistry deployed to ${toSAcceptanceRegistry.address}`
  );

  // Set ToSAcceptanceRegsitry URL
  const TOS_ACCEPTANCE_REGISTRY_URL = "http://example.com"; // TODO update with real URL
  const setTosUrlTx = await toSAcceptanceRegistry.updateTermsOfService(
    TOS_ACCEPTANCE_REGISTRY_URL
  );
  await setTosUrlTx.wait();
  console.log(
    `ToSAcceptanceRegistry URL set to ${TOS_ACCEPTANCE_REGISTRY_URL}`
  );

  // Update ServiceConfiguration with the ToSAcceptanceRegistry
  const setTosRegistryTx = await serviceConfiguration.setToSAcceptanceRegistry(
    toSAcceptanceRegistry.address
  );
  await setTosRegistryTx.wait();
  console.log(`ServiceConfiguration updated with new ToSAcceptanceRegistry`);

  // Deploy PoolAdminAccessControl
  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl"
  );
  const poolAdminAccessControl = await PoolAdminAccessControl.deploy(
    serviceConfiguration.address
  );
  await poolAdminAccessControl.deployed();
  console.log(
    `PoolAdminAccess control deployed at ${poolAdminAccessControl.address}`
  );

  // Update ServiceConfigurtation with the PoolAdminAccessControl
  await serviceConfiguration.setPoolAdminAccessControl(
    poolAdminAccessControl.address
  );
  console.log("ServiceConfiguration updated with new PoolAdminAccessControl");

  // Deploy PoolLib
  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();
  console.log(`PoolLib deployed to ${poolLib.address}`);

  // Deploy LoanLib
  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();
  console.log(`LoanLib deployed to ${loanLib.address}`);

  // Deploy PoolAccessControlFactory
  const PoolAccessControlFactory = await ethers.getContractFactory(
    "PoolAccessControlFactory"
  );
  const poolAccessControlFactory = await PoolAccessControlFactory.deploy(
    serviceConfiguration.address
  );
  await poolAccessControlFactory.deployed();
  console.log(
    `PoolAccessControlFactory deployed to ${poolAccessControlFactory.address}`
  );

  // Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory(
    "PermissionedPoolFactory",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const poolFactory = await PoolFactory.deploy(
    serviceConfiguration.address,
    poolAccessControlFactory.address
  );
  await poolFactory.deployed();
  console.log(`PermissionedPoolFactory deployed to ${poolFactory.address}`);

  // Deploy LoanFactory
  const LoanFactory = await ethers.getContractFactory(
    "PermissionedLoanFactory",
    {
      libraries: {
        LoanLib: loanLib.address
      }
    }
  );
  const loanFactory = await LoanFactory.deploy(serviceConfiguration.address);
  await loanFactory.deployed();
  console.log(`PermissionedLoanFactory deployed to ${loanFactory.address}`);

  // Deploy WithdrawControllerFactory
  const WithdrawControllerFactory = await ethers.getContractFactory(
    "WithdrawControllerFactory",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const withdrawControllerFactory = await WithdrawControllerFactory.deploy(
    serviceConfiguration.address
  );
  await withdrawControllerFactory.deployed();
  console.log(
    `WithdrawControllerFactory deployed to ${withdrawControllerFactory.address}`
  );

  // Deploy PoolControllerFactory
  const PoolControllerFactory = await ethers.getContractFactory(
    "PoolControllerFactory",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const poolControllerFactory = await PoolControllerFactory.deploy(
    serviceConfiguration.address
  );
  await poolControllerFactory.deployed();
  console.log(
    `PoolControllerFactory deployed to ${poolControllerFactory.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
