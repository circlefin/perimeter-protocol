import { ethers } from "hardhat";
import hre from "hardhat";

type ExtendedHreNetworkConfig = typeof hre.network.config & {
  usdcAddress: string | undefined;
};

async function main() {
  // Address of the ToSAcceptanceRegistry contract
  const poolAddress = "0x4c9d66B3c89Aa1E4C4EBa58920858d6447F4d97A";
  const poolLibAddress = "0x84c5b1f0DFFa76fAF38a8BB9fab746a5e079745c";
  const amount = 10_000000;

  const [admin, operator, deployer, pauser, other, lender] =
    await hre.ethers.getSigners();

  const Pool = await ethers.getContractFactory("PermissionedPool", {
    libraries: {
      PoolLib: poolLibAddress
    }
  });
  const pool = Pool.attach(poolAddress).connect(lender);

  const ERC20 = await ethers.getContractFactory("ERC20");
  const liquidityAsset = ERC20.attach(
    (hre.network.config as ExtendedHreNetworkConfig).usdcAddress!
  );
  const tx0 = await liquidityAsset
    .connect(lender)
    .approve(pool.address, amount);
  await tx0.wait();
  console.log(`Allowance set: ${amount}`);

  const tx1 = await pool.deposit(amount, lender.address);
  await tx1.wait();
  console.log(`Deposited: ${amount}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
