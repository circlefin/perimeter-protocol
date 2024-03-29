/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

/**
 * @notice A sample deployment script deploying the core contracts of Perimeter
 * @dev 4 key roles are used and configured as part of this deployment process:
 * the protocol Admin, the Operator, the Deployer, and the Pauser.
 *
 * These are read as Ethers signers, and configured from the Hardhat Config using the following environment
 * variables set in a .env file:
 *
 * ACCOUNT_ADMIN
 * ACCOUNT_OPERATOR
 * ACCOUNT_DEPLOYER
 * ACCOUNT_PAUSER
 *
 * Additionally, several configuration values are used:
 *
 * DEPLOY_VERITE_SCHEMA - e.g. https://verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person
 * DEPLOY_VERITE_VERIFIER - the address of a verifier
 * DEPLOY_TOS_ACCEPTANCE_URL - the URL pointing to a ToS requiring consent
 * DEPLOY_FL_MINIMUM - The minimum amount of first loss required to be contributed to a pool.
 */
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
  const TOS_ACCEPTANCE_REGISTRY_URL = process.env["DEPLOY_TOS_ACCEPTANCE_URL"];
  if (TOS_ACCEPTANCE_REGISTRY_URL != null) {
    const setTosUrlTx = await toSAcceptanceRegistry
      .connect(operator)
      .updateTermsOfService(TOS_ACCEPTANCE_REGISTRY_URL);
    await setTosUrlTx.wait();
    console.log(
      `ToSAcceptanceRegistry URL set to ${TOS_ACCEPTANCE_REGISTRY_URL}`
    );
  }

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
  const PoolController = await ethers.getContractFactory(
    "PermissionedPoolController",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const poolController = await PoolController.deploy();
  await poolController.deployed();
  console.log(
    `PermissionedPoolController deployed to ${poolController.address}`
  );
  tx = await poolControllerFactory
    .connect(deployer)
    .setImplementation(poolController.address);
  await tx.wait();
  console.log(
    `PermissionedPoolController set as implementation for its factory`
  );

  // Deploy VaultFactory
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactory = await VaultFactory.deploy(serviceConfiguration.address);
  await vaultFactory.deployed();
  console.log(`VaultFactory deployed to ${vaultFactory.address}`);
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy();
  await vault.deployed();
  console.log(`Vault deployed to ${vault.address}`);
  tx = await vaultFactory.connect(deployer).setImplementation(vault.address);
  await tx.wait();
  console.log(`Vault set as implementation for its factory`);

  // Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory(
    "PermissionedPoolFactory",
    {}
  );
  const poolFactory = await PoolFactory.deploy(
    serviceConfiguration.address,
    withdrawControllerFactory.address,
    poolControllerFactory.address,
    vaultFactory.address,
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
  console.log(`Pool set as implementation for its factory`);

  // Deploy LoanFactory
  const LoanFactory = await ethers.getContractFactory(
    "PermissionedLoanFactory"
  );
  const loanFactory = await LoanFactory.deploy(
    serviceConfiguration.address,
    vaultFactory.address
  );
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

  // Set first loss minimum
  const firstLossMin = ethers.BigNumber.from(
    process.env["DEPLOY_FL_MINIMUM"] ?? 10_000_000000
  );
  tx = await serviceConfiguration
    .connect(operator)
    .setFirstLossMinimum(usdcAddress, firstLossMin);
  console.log(
    `ServiceConfiguration: set USDC first loss minimum to ${firstLossMin}`
  );

  // Configure Verite
  const credentialSchema = process.env["DEPLOY_VERITE_SCHEMA"];
  const trustedVerifier = process.env["DEPLOY_VERITE_VERIFIER"]; // For demonstration

  if (credentialSchema != null) {
    tx = await poolAdminAccessControl
      .connect(operator)
      .addCredentialSchema([credentialSchema]);
    console.log(`Added Verite credential schema: ${credentialSchema}`);
  }

  if (trustedVerifier != null) {
    tx = await poolAdminAccessControl
      .connect(operator)
      .addTrustedVerifier(trustedVerifier);
    console.log(`Added Verite trusted verifier: ${trustedVerifier}`);
  }

  process.exitCode = 0;
  process.exit(0);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
