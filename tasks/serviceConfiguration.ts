import { task } from "hardhat/config";
import { ContractFactory } from "ethers";

task(
  "serviceConfigurationView",
  "Get public properties of the service configuration"
)
  .addParam("address", "Address of the service configuration contract")
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.address);
    console.log("paused: ", await serviceConfiguration.paused());
    console.log(
      "firstLossFeeBps: ",
      await serviceConfiguration.firstLossFeeBps()
    );
    console.log(
      "tosAcceptanceRegistry: ",
      await serviceConfiguration.tosAcceptanceRegistry()
    );
  });

/**
 * Example:
 * npx hardhat serviceConfigurationIsOperator --network localhost --contract 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 --address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 */
task("serviceConfigurationIsOperator", "Check if address is an operator")
  .addParam("contract", "Address of the service configuration contract")
  .addParam("address", "Address of the operator")
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.contract);
    console.log(
      "isOperator: ",
      await serviceConfiguration.isOperator(taskArgs.address)
    );
  });

task(
  "serviceConfigurationIsLiquidityAsset",
  "Check if address is a valid liquidity asset"
)
  .addParam("contract", "Address of the service configuration contract")
  .addParam("address", "Address of the token")
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.contract);
    console.log(
      "isLiquidityAsset: ",
      await serviceConfiguration.isLiquidityAsset(taskArgs.address)
    );
  });

task(
  "serviceConfigurationIsLoanFactory",
  "Check if address is a valid loan factory"
)
  .addParam("contract", "Address of the service configuration contract")
  .addParam("address", "Address of the loan factory")
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.contract);
    console.log(
      "isLoanFactory: ",
      await serviceConfiguration.isLoanFactory(taskArgs.address)
    );
  });

task("serviceConfigurationSetPaused", "Pauses the protocol")
  .addParam("address", "Address of the service configuration contract")
  .addOptionalParam("paused", `"true" to pause, "false" to unpause`, "true")
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.address);
    const tx = await serviceConfiguration.setPaused(taskArgs.paused === "true");
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.transactionHash);
  });

task(
  "serviceConfigurationSetLiquidityAsset",
  "Set a token as a liquidity asset"
)
  .addParam("address", "Address of the service configuration contract")
  .addParam("token", "Address of the token")
  .addOptionalParam("enabled", `"true" to enable, "false" to disable`)
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.address);
    const tx = await serviceConfiguration.setLiquidityAsset(
      taskArgs.token,
      taskArgs.enabled === "true"
    );
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.transactionHash);
  });

task("serviceConfigurationSetLoanFactory", "Set a loan factory")
  .addParam("address", "Address of the service configuration contract")
  .addParam("factory", "Address of the loan factory")
  .addOptionalParam("enabled", `"true" to enable, "false" to disable`)
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.address);
    const tx = await serviceConfiguration.setLoanFactory(
      taskArgs.factory,
      taskArgs.enabled === "true"
    );
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.transactionHash);
  });

task("serviceConfigurationSetToSAcceptanceRegistry", "Set a ToS registry")
  .addParam("address", "Address of the service configuration contract")
  .addParam("registry", "Address of the ToS registry")
  .setAction(async (taskArgs, hre) => {
    const ServiceConfiguration: ContractFactory =
      await hre.ethers.getContractFactory("ServiceConfiguration");
    const serviceConfiguration = ServiceConfiguration.attach(taskArgs.address);
    const tx = await serviceConfiguration.setToSAcceptanceRegistry(
      taskArgs.registry
    );
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.transactionHash);
  });
