import { ethers } from "hardhat";

async function main() {
  const PoolManagerAccessControl = await ethers.getContractFactory(
    "PoolManagerAccessControl"
  );
  const poolManagerAccessControl = await PoolManagerAccessControl.deploy();

  await poolManagerAccessControl.deployed();

  console.log(
    `PoolManagerAccessControl deployed to ${poolManagerAccessControl.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
