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
import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Address of the ToSAcceptanceRegistry contract
  const tosAcceptanceRegistryAddress = "";
  // Address of the PoolAdminAccessControl contract
  const poolAdminAccessControlAddress = "";
  // The VerificationResult and signature from a Verite verifier. You can run the script
  // `verite-verify` to get your own results
  const verificationResult = {
    schema: [
      "https://verite.id/definitions/processes/kycaml/0.0.1/generic--usa-legal_person"
    ],
    subject: "",
    expiration: 1671133884,
    verifier_verification_id: ""
  };
  const signature = "";

  const [admin, operator, deployer, pauser, other] =
    await hre.ethers.getSigners();

  let tx;

  // Accept TOS
  const ToSAcceptanceRegistry = await ethers.getContractFactory(
    "ToSAcceptanceRegistry"
  );
  const tosAcceptanceRegistry = ToSAcceptanceRegistry.attach(
    tosAcceptanceRegistryAddress
  ).connect(other);

  tx = await tosAcceptanceRegistry.acceptTermsOfService();
  await tx.wait();
  console.log("Accepted TOS");

  // Verify with Verite
  const PoolAdminAccessControl = await ethers.getContractFactory(
    "PoolAdminAccessControl"
  );
  const poolAdminAccessControl = PoolAdminAccessControl.attach(
    poolAdminAccessControlAddress
  );

  tx = await poolAdminAccessControl
    .connect(other)
    .verify(verificationResult, signature);
  await tx.wait();
  console.log("Verified!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
