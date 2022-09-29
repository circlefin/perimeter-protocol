import { ethers } from "hardhat";
import { MockERC20, Pool } from "../../typechain-types";
import { deployMockERC20 } from "./erc20";

export const DEFAULT_POOL_SETTINGS = {
  maxCapacity: 10_000_000,
  endDate: 2524611601, // Jan 1, 2050
  withdrawalFee: 50, // bips,
  firstLossInitialMinimum: 100_000,
  withdrawWindowDurationSeconds: 30 * 24 * 60 * 60 // 30 days
};

/**
 * Deploy an "Initialized" Pool
 */
export async function deployPool(
  poolManager: any,
  poolSettings = DEFAULT_POOL_SETTINGS
) {
  const { mockERC20: liquidityAsset } = await deployMockERC20();

  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  const Pool = await ethers.getContractFactory("Pool", {
    libraries: {
      PoolLib: poolLib.address
    }
  });

  const pool = await Pool.deploy(
    liquidityAsset.address,
    poolManager.address,
    poolSettings,
    "Valyria PoolToken",
    "VPT"
  );
  await pool.deployed();

  await liquidityAsset.mint(
    poolManager.address,
    poolSettings.firstLossInitialMinimum
  );

  return { pool, liquidityAsset };
}

/**
 * Deploy an "Active" Pool
 */
export async function activatePool(
  pool: Pool,
  poolManager: any,
  liquidityAsset: MockERC20
) {
  const { firstLossInitialMinimum } = await pool.settings();

  // Grant allowance
  await liquidityAsset
    .connect(poolManager)
    .approve(pool.address, firstLossInitialMinimum);

  await pool
    .connect(poolManager)
    .depositFirstLoss(firstLossInitialMinimum, poolManager.address);

  return { pool, liquidityAsset };
}

/**
 *
 */
export async function depositToPool(
  pool: Pool,
  depositorAccount: any,
  asset: MockERC20,
  amount: number
) {
  // Provide capital to lender
  await asset.mint(depositorAccount.address, amount);

  // Approve the deposit
  await asset.connect(depositorAccount).approve(pool.address, amount);

  // Deposit
  return pool
    .connect(depositorAccount)
    .deposit(amount, depositorAccount.address);
}
