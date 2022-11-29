import { task } from "hardhat/config";
import { ContractFactory } from "ethers";

task("setPaused", "Pauses the protocol")
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

task("setLiquidityAsset", "Set a token as a liquidity asset")
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

task("setLoanFactory", "Set a loan factory")
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

task("setToSAcceptanceRegistry", "Set a ToS registry")
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
