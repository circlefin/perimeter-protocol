import { ethers, upgrades } from "hardhat";
import hre from "hardhat";

async function main() {
  const [admin, operator, deployer, pauser, other] = await ethers.getSigners();

  // Inputs
  const participantAddress = other.address;
  const poolAddress = "0x4c9d66B3c89Aa1E4C4EBa58920858d6447F4d97A";
  const poolLibAddress = "0x84c5b1f0DFFa76fAF38a8BB9fab746a5e079745c";

  // Verify Pool Lender/Borrower
  const Pool = await ethers.getContractFactory("PermissionedPool", {
    libraries: {
      PoolLib: poolLibAddress
    }
  });
  const pool = Pool.attach(poolAddress);

  const poolAccessControlAddress = await pool.poolAccessControl();

  const PoolAccessControl = await ethers.getContractFactory(
    "PoolAccessControl"
  );
  const poolAccessControl = PoolAccessControl.attach(
    poolAccessControlAddress
  ).connect(other);

  const tx = await poolAccessControl
    .connect(other)
    .allowParticipant(participantAddress);
  const receipt = await tx.wait();
  console.log(`Participant added: ${receipt.transactionHash}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
