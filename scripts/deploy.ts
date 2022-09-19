import { ethers } from "hardhat";

async function main() {
  const PoolManagerPermission = await ethers.getContractFactory(
    "PoolManagerPermission"
  );
  const poolManagerPermission = await PoolManagerPermission.deploy();

  await poolManagerPermission.deployed();

  console.log(
    `PoolManagerPermission deployed to ${poolManagerPermission.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
