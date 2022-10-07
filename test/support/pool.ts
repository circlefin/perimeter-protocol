import { ethers } from "hardhat";
import { MockERC20, Pool } from "../../typechain-types";
import { deployMockERC20 } from "./erc20";
import { deployServiceConfiguration } from "./serviceconfiguration";

export const DEFAULT_POOL_SETTINGS = {
  maxCapacity: 10_000_000,
  endDate: 2524611601, // Jan 1, 2050
  requestFeeBps: 50, // bips,
  firstLossInitialMinimum: 100_000,
  withdrawRequestPeriodDuration: 30 * 24 * 60 * 60 // 30 days
};

/**
 * Deploy an "Initialized" Pool
 */
export async function deployPool(
  poolManager: any,
  settings?: Partial<typeof DEFAULT_POOL_SETTINGS>
) {
  const { mockERC20: liquidityAsset } = await deployMockERC20();
  const poolSettings = {
    ...DEFAULT_POOL_SETTINGS,
    ...settings
  };

  const { serviceConfiguration } = await deployServiceConfiguration();

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
    serviceConfiguration.address,
    poolSettings,
    "Valyria PoolToken",
    "VPT"
  );
  await pool.deployed();

  await liquidityAsset.mint(
    poolManager.address,
    poolSettings.firstLossInitialMinimum
  );

  return { pool, liquidityAsset, serviceConfiguration };
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
  amount: any
) {
  // Provide fake USDC capital to lender
  await asset.mint(depositorAccount.address, amount);

  // Approve the deposit
  await asset.connect(depositorAccount).approve(pool.address, amount);

  // Deposit
  return pool
    .connect(depositorAccount)
    .deposit(amount, depositorAccount.address);
}
