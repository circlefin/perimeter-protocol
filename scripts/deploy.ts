import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

async function main() {
  // The token we use for the liquidity asset must exist. If it is not defined, we'll deploy a mock token.
  let usdcAddress = (hre.network.config as ExtendedHreNetworkConfig)
    .usdcAddress;

  if (!usdcAddress) {
    const Usdc = await ethers.getContractFactory("MockERC20");
    const usdc = await Usdc.deploy("USD Coin", "USDC", 6);
    await usdc.deployed();
    console.log(`Deployed mock USDC token to ${usdc.address}`);
    usdcAddress = usdc.address;
  }

  const [admin, operator, deployer, pauser] = await ethers.getSigners();

  // Deploy ServiceConfiguration
  const ServiceConfiguration = await ethers.getContractFactory(
    "PermissionedServiceConfiguration",
    admin
  );
  const serviceConfiguration = await upgrades.deployProxy(
    ServiceConfiguration,
    { kind: "uups" }
  );
  await serviceConfiguration.deployed();
  console.log(
    `ServiceConfiguration deployed to ${serviceConfiguration.address}`
  );

  // Grant operator role
  let tx = await serviceConfiguration
    .connect(admin)
    .grantRole(serviceConfiguration.OPERATOR_ROLE(), operator.address);
  await tx.wait();
  console.log(`Granted operator role to ${operator.address}`);

  // Grant pauser role
  tx = await serviceConfiguration
    .connect(admin)
    .grantRole(serviceConfiguration.PAUSER_ROLE(), pauser.address);
  await tx.wait();
  console.log(`Granted pauser role to ${pauser.address}`);

  // Grant deployer role
  tx = await serviceConfiguration
    .connect(admin)
    .grantRole(serviceConfiguration.DEPLOYER_ROLE(), deployer.address);
  await tx.wait();
  console.log(`Granted deployer role to ${deployer.address}`);

  // Deploy ToSAcceptanceRegistry
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry",
    admin
  );
  const toSAcceptanceRegistry = await upgrades.deployProxy(
    ToSAcceptanceRegistry,
    [serviceConfiguration.address],
    { kind: "uups" }
  );
  await toSAcceptanceRegistry.deployed();
  console.log(
    `ToSAcceptanceRegistry deployed to ${toSAcceptanceRegistry.address}`
  );

  // Set ToSAcceptanceRegsitry URL
  const TOS_ACCEPTANCE_REGISTRY_URL = "http://example.com"; // TODO update with real URL
  const setTosUrlTx = await toSAcceptanceRegistry
    .connect(operator)
    .updateTermsOfService(TOS_ACCEPTANCE_REGISTRY_URL);
  await setTosUrlTx.wait();
  console.log(
    `ToSAcceptanceRegistry URL set to ${TOS_ACCEPTANCE_REGISTRY_URL}`
  );

  // Update ServiceConfiguration with the ToSAcceptanceRegistry
  const setTosRegistryTx = await serviceConfiguration
    .connect(operator)
    .setToSAcceptanceRegistry(toSAcceptanceRegistry.address);
  await setTosRegistryTx.wait();
  console.log(`ServiceConfiguration updated with new ToSAcceptanceRegistry`);

  // Deploy PoolAdminAccessControl
  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl",
    admin
  );
  const poolAdminAccessControl = await upgrades.deployProxy(
    PoolAdminAccessControl,
    [serviceConfiguration.address],
    { kind: "uups" }
  );
  await poolAdminAccessControl.deployed();
  console.log(
    `PoolAdminAccess control deployed at ${poolAdminAccessControl.address}`
  );

  // Update ServiceConfigurtation with the PoolAdminAccessControl
  await serviceConfiguration
    .connect(operator)
    .setPoolAdminAccessControl(poolAdminAccessControl.address);
  console.log("ServiceConfiguration updated with new PoolAdminAccessControl");

  // Deploy PoolLib
  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();
  await poolLib.deployed();
  console.log(`PoolLib deployed to ${poolLib.address}`);

  // Deploy LoanLib
  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();
  await loanLib.deployed();
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
  const PoolAccessControl = await ethers.getContractFactory(
    "PoolAccessControl"
  );
  const poolAccessControl = await PoolAccessControl.deploy();
  await poolAccessControl.deployed();
  console.log(`PoolAccessControl deployed to ${poolAccessControl.address}`);
  await poolAccessControlFactory
    .connect(deployer)
    .setImplementation(poolAccessControl.address);
  console.log(`PoolAccessControl set as implementation for its factory`);

  // Deploy WithdrawControllerFactory
  const WithdrawControllerFactory = await ethers.getContractFactory(
    "WithdrawControllerFactory"
  );
  const withdrawControllerFactory = await WithdrawControllerFactory.deploy(
    serviceConfiguration.address
  );
  await withdrawControllerFactory.deployed();
  console.log(
    `WithdrawControllerFactory deployed to ${withdrawControllerFactory.address}`
  );
  const WithdrawController = await ethers.getContractFactory(
    "WithdrawController",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const withdrawController = await WithdrawController.deploy();
  await withdrawController.deployed();
  console.log(`WithdrawController deployed to ${withdrawController.address}`);
  await withdrawControllerFactory
    .connect(deployer)
    .setImplementation(withdrawController.address);
  console.log(`WithdrawController set as implementation for its factory`);

  // Deploy PoolControllerFactory
  const PoolControllerFactory = await ethers.getContractFactory(
    "PoolControllerFactory"
  );
  const poolControllerFactory = await PoolControllerFactory.deploy(
    serviceConfiguration.address
  );
  await poolControllerFactory.deployed();
  console.log(
    `PoolControllerFactory deployed to ${poolControllerFactory.address}`
  );
  const PoolController = await ethers.getContractFactory("PoolController", {
    libraries: {
      PoolLib: poolLib.address
    }
  });
  const poolController = await PoolController.deploy();
  await poolController.deployed();
  console.log(`PoolController deployed to ${poolController.address}`);
  tx = await poolControllerFactory
    .connect(deployer)
    .setImplementation(poolController.address);
  await tx.wait();
  console.log(`PoolController set as implementation for its factory`);

  // Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory(
    "PermissionedPoolFactory",
    {}
  );
  const poolFactory = await PoolFactory.deploy(
    serviceConfiguration.address,
    withdrawControllerFactory.address,
    poolControllerFactory.address,
    poolAccessControlFactory.address
  );
  await poolFactory.deployed();
  console.log(`PoolFactory deployed to ${poolFactory.address}`);
  const Pool = await ethers.getContractFactory("PermissionedPool", {
    libraries: {
      PoolLib: poolLib.address
    }
  });
  const pool = await Pool.deploy();
  await pool.deployed();
  console.log(`Pool deployed to ${pool.address}`);
  tx = await poolFactory.connect(deployer).setImplementation(pool.address);
  await tx.wait();
  console.log(`Pool set as imlementation for its factory`);

  // Deploy LoanFactory
  const LoanFactory = await ethers.getContractFactory(
    "PermissionedLoanFactory"
  );
  const loanFactory = await LoanFactory.deploy(serviceConfiguration.address);
  await loanFactory.deployed();
  console.log(`LoanFactory deployed to ${loanFactory.address}`);

  const Loan = await ethers.getContractFactory("PermissionedLoan", {
    libraries: {
      LoanLib: loanLib.address
    }
  });
  const loan = await Loan.deploy();
  await loan.deployed();
  console.log(`Loan deployed to ${loan.address}`);
  await loanFactory.connect(deployer).setImplementation(loan.address);
  console.log(`Loan set as implementation for its Factory`);

  // Setup LoanFactory
  tx = await serviceConfiguration
    .connect(operator)
    .setLoanFactory(loanFactory.address, true);
  await tx.wait();
  console.log(`ServiceConfiguration: set LoanFactory as valid`);

  // Set USDC as a liquidity asset for the protocol
  tx = await serviceConfiguration
    .connect(operator)
    .setLiquidityAsset(usdcAddress, true);
  await tx.wait();
  console.log(`ServiceConfiguration: set USDC as a liquidity asset`);

  // Set first loss minimum to $10,000
  tx = await serviceConfiguration
    .connect(operator)
    .setFirstLossMinimum(usdcAddress, 10_000_000000);
  console.log(`ServiceConfiguration: set USDC first loss minimum to $10,000`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
