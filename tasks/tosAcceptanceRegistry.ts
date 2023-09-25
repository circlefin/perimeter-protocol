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
import { task } from "hardhat/config";
import { ContractFactory } from "ethers";

task(
  "tosAcceptanceRegistryView",
  "Get public properties of the ToS Acceptance Registry"
)
  .addParam("contract", "Address of the ToS Acceptance Registry contract")
  .setAction(async (taskArgs, hre) => {
    const TosAcceptanceRegistry: ContractFactory =
      await hre.ethers.getContractFactory("ToSAcceptanceRegistry");
    const tosAcceptanceRegistry = TosAcceptanceRegistry.attach(
      taskArgs.contract
    );
    console.log(
      "termsOfService: ",
      await tosAcceptanceRegistry.termsOfService()
    );
  });

task(
  "tosAcceptanceRegistryUpdateTermsOfService",
  "Update the terms of service URL"
)
  .addParam("contract", "Address of the ToS Acceptance Registry contract")
  .addParam("url", "URL of the new terms of service")
  .setAction(async (taskArgs, hre) => {
    const TosAcceptanceRegistry: ContractFactory =
      await hre.ethers.getContractFactory("ToSAcceptanceRegistry");
    const tosAcceptanceRegistry = TosAcceptanceRegistry.attach(
      taskArgs.contract
    );
    const tx = await tosAcceptanceRegistry.updateTermsOfService(taskArgs.url);
    await tx.wait();
    console.log(
      "termsOfService: ",
      await tosAcceptanceRegistry.termsOfService()
    );
  });

task(
  "tosAcceptanceRegistryHasAccepted",
  "Check if address has accepted the terms of service"
)
  .addParam("contract", "Address of the ToS Acceptance Registry contract")
  .addParam("address", "address to check")
  .setAction(async (taskArgs, hre) => {
    const TosAcceptanceRegistry: ContractFactory =
      await hre.ethers.getContractFactory("ToSAcceptanceRegistry");
    const tosAcceptanceRegistry = TosAcceptanceRegistry.attach(
      taskArgs.contract
    );
    console.log(
      "hasAccepted: ",
      await tosAcceptanceRegistry.hasAccepted(taskArgs.address)
    );
  });

task("tosAcceptanceRegistryAcceptTermsOfService", "Accept the terms of service")
  .addParam("contract", "Address of the ToS Acceptance Registry contract")
  .setAction(async (taskArgs, hre) => {
    const TosAcceptanceRegistry: ContractFactory =
      await hre.ethers.getContractFactory("ToSAcceptanceRegistry");
    const tosAcceptanceRegistry = TosAcceptanceRegistry.attach(
      taskArgs.contract
    );
    const tx = await tosAcceptanceRegistry.acceptTermsOfService();
    await tx.wait();
    console.log(
      "hasAccepted: ",
      await tosAcceptanceRegistry.hasAccepted(
        tosAcceptanceRegistry.signer.getAddress()
      )
    );
  });
