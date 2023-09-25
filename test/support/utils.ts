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

export function findEventByName(receipt: any, name: string) {
  return receipt.events?.find((event: any) => event.event == name);
}

/**
 * Get commonly-used signers.
 */
export async function getCommonSigners() {
  // To maintain compatability across networks, order should match what is
  // defined in the hardhat config
  const [
    admin,
    operator,
    deployer,
    pauser,
    poolAdmin,
    borrower,
    lender,
    aliceLender,
    bobLender,
    other,
    otherAccount,
    ...otherAccounts
  ] = await ethers.getSigners();

  return {
    admin: admin,
    operator: operator,
    deployer: deployer,
    pauser: pauser,
    poolAdmin: poolAdmin,
    borrower: borrower,
    lender: lender,
    aliceLender: aliceLender,
    bobLender: bobLender,
    otherAccount: otherAccount,
    other: other,
    otherAccounts: otherAccounts
  };
}
