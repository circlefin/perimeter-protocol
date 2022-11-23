import { ethers } from "hardhat";
import { DEFAULT_POOL_SETTINGS } from "../test/support/pool";

async function main() {
  // Deploy ServiceConfiguration
  const ServiceConfiguration = await ethers.getContractFactory(
    "ServiceConfiguration"
  );
  const serviceConfiguration = await ServiceConfiguration.deploy();
  await serviceConfiguration.deployed();

  console.log(
    `ServiceConfiguration deployed to ${serviceConfiguration.address}`
  );

  // Deploy mock USD Coin
  const Usdc = await ethers.getContractFactory("MockERC20");
  const usdc = await Usdc.deploy("USD Coin", "USDC", 6);
  await usdc.deployed();

  console.log(`USDC deployed to ${usdc.address}`);

  // Deploy PoolLib
  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  console.log(`PoolLib deployed to ${poolLib.address}`);

  // Deploy LoanLib
  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();

  console.log(`LoanLib deployed to ${loanLib.address}`);

  // Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory("PoolFactory", {
    libraries: {
      PoolLib: poolLib.address
    }
  });
  const poolFactory = await PoolFactory.deploy(usdc.address);
  await poolFactory.deployed();

  console.log(`PoolFactory deployed to ${poolFactory.address}`);

  // Deploy LoanFactory
  const LoanFactory = await ethers.getContractFactory("LoanFactory", {
    libraries: {
      LoanLib: loanLib.address
    }
  });
  const loanFactory = await LoanFactory.deploy(serviceConfiguration.address);
  await loanFactory.deployed();

  console.log(`LoanFactory deployed to ${loanFactory.address}`);

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
