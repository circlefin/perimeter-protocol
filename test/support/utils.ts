import { ethers } from "hardhat";

export function findEventByName(receipt: any, name: string) {
  return receipt.events?.find((event: any) => event.event == name);
}

/**
 * Get commonly-used signers.
 */
export async function getCommonSigners() {
  const [
    operator,
    admin,
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
