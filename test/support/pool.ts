import { ethers } from "hardhat";
import { MockERC20, Pool } from "../../typechain-types";
import { deployMockERC20 } from "./erc20";
import {
  deployPermissionedServiceConfiguration,
  deployServiceConfiguration
} from "./serviceconfiguration";

export const DEFAULT_POOL_SETTINGS = {
  maxCapacity: 10_000_000,
  endDate: 2524611601, // Jan 1, 2050
  requestFeeBps: 500, // bps (5%)
  requestCancellationFeeBps: 100, // bps (1%)
  withdrawGateBps: 10_000, // bps (100%)
  firstLossInitialMinimum: 100_000,
  withdrawRequestPeriodDuration: 30 * 24 * 60 * 60, // 30 days
  fixedFee: 0,
  fixedFeeInterval: 0,
  poolFeePercentOfInterest: 0 // bps (0%)
};

type DeployPoolProps = {
  operator: any;
  poolAdmin: any;
  settings?: Partial<typeof DEFAULT_POOL_SETTINGS>;
  liquidityAsset?: MockERC20;
};

/**
 * Deploy an "Initialized" Pool
 */

export async function deployPool({
  operator,
  poolAdmin,
  settings,
  liquidityAsset
}: DeployPoolProps) {
  const poolSettings = {
    ...DEFAULT_POOL_SETTINGS,
    ...settings
  };
  liquidityAsset = liquidityAsset ?? (await deployMockERC20()).mockERC20;

  const { serviceConfiguration } = await deployServiceConfiguration(operator);
  await serviceConfiguration.setLiquidityAsset(liquidityAsset.address, true);

  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  const PoolFactory = await ethers.getContractFactory("PoolFactory", {
    signer: poolAdmin,
    libraries: {
      PoolLib: poolLib.address
    }
  });
  const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
  await poolFactory.deployed();

  const WithdrawControllerFactory = await ethers.getContractFactory(
    "WithdrawControllerFactory",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const withdrawControllerFactory = await WithdrawControllerFactory.deploy(
    serviceConfiguration.address
  );
  await withdrawControllerFactory.deployed();

  const txn = await poolFactory
    .connect(poolAdmin)
    .createPool(
      liquidityAsset.address,
      withdrawControllerFactory.address,
      poolSettings
    );

  const txnReceipt = await txn.wait();
  const poolCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "PoolCreated"
  );
  const poolAddress = poolCreatedEvent?.args?.[0];
  const pool = await ethers.getContractAt("Pool", poolAddress);

  await liquidityAsset.mint(
    poolAdmin.address,
    poolSettings.firstLossInitialMinimum
  );

  const withdrawController = await ethers.getContractAt(
    "WithdrawController",
    await pool.withdrawController()
  );

  return { pool, liquidityAsset, serviceConfiguration, withdrawController };
}

/**
 * Deploy an "Initialized" Pool
 */
export async function deployPermissionedPool({
  poolAdmin,
  operator,
  settings,
  liquidityAsset
}: DeployPoolProps) {
  const poolSettings = {
    ...DEFAULT_POOL_SETTINGS,
    ...settings
  };
  liquidityAsset = liquidityAsset ?? (await deployMockERC20()).mockERC20;

  const {
    serviceConfiguration,
    tosAcceptanceRegistry,
    poolAdminAccessControl
  } = await deployPermissionedServiceConfiguration(operator);

  await tosAcceptanceRegistry.connect(poolAdmin).acceptTermsOfService();
  await poolAdminAccessControl.connect(operator).allow(poolAdmin.address);

  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  const PoolFactory = await ethers.getContractFactory(
    "PermissionedPoolFactory",
    {
      signer: poolAdmin,
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
  await poolFactory.deployed();

  const WithdrawControllerFactory = await ethers.getContractFactory(
    "WithdrawControllerFactory",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const withdrawControllerFactory = await WithdrawControllerFactory.deploy(
    serviceConfiguration.address
  );
  await withdrawControllerFactory.deployed();

  const txn = await poolFactory
    .connect(poolAdmin)
    .createPool(
      liquidityAsset.address,
      withdrawControllerFactory.address,
      poolSettings
    );

  const txnReceipt = await txn.wait();
  const poolCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "PoolCreated"
  );
  const poolAddress = poolCreatedEvent?.args?.[0];
  const pool = await ethers.getContractAt("PermissionedPool", poolAddress);

  await liquidityAsset.mint(
    poolAdmin.address,
    poolSettings.firstLossInitialMinimum
  );

  const withdrawController = await ethers.getContractAt(
    "WithdrawController",
    await pool.withdrawController()
  );

  return {
    pool,
    liquidityAsset,
    serviceConfiguration,
    withdrawController,
    tosAcceptanceRegistry,
    poolAdminAccessControl
  };
}

/**
 * Deploy an "Active" Pool
 */
export async function activatePool(
  pool: Pool,
  poolAdmin: any,
  liquidityAsset: MockERC20
) {
  const { firstLossInitialMinimum } = await pool.settings();

  // Grant allowance
  await liquidityAsset
    .connect(poolAdmin)
    .approve(pool.address, firstLossInitialMinimum);

  await pool
    .connect(poolAdmin)
    .depositFirstLoss(firstLossInitialMinimum, poolAdmin.address);

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

type WithdrawState = {
  requestedShares: number;
  eligibleShares: number;
  latestRequestPeriod: number;
  redeemableShares: number;
  withdrawableAssets: number;
};

/**
 *
 */
export const buildWithdrawState = (
  overrides: Partial<WithdrawState> = {}
): WithdrawState => {
  return Object.assign(
    {},
    {
      requestedShares: 0,
      eligibleShares: 0,
      latestRequestPeriod: 0,
      redeemableShares: 0,
      withdrawableAssets: 0
    },
    overrides
  );
};
