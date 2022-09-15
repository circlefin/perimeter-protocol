import { ethers } from "hardhat";

async function main() {
  const ProtocolPermission = await ethers.getContractFactory(
    "ProtocolPermission"
  );
  const protocolPermission = await ProtocolPermission.deploy();

  await protocolPermission.deployed();

  console.log(`ProtocolPermission deployed to ${protocolPermission.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
