import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockERC20, Pool } from "../../typechain-types";
import { deployMockERC20 } from "./erc20";
import {
  deployPermissionedServiceConfiguration,
  deployServiceConfiguration
} from "./serviceconfiguration";
import { performVeriteVerification } from "./verite";
import { getCommonSigners } from "./utils";

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
  serviceFeeBps: 0 // bps (0%)
};

type DeployPoolProps = {
  poolAdmin: any;
  settings?: Partial<typeof DEFAULT_POOL_SETTINGS>;
  liquidityAsset?: MockERC20;
  pauser?: any;
};

/**
 * Deploy an "Initialized" Pool
 */
export async function deployPool({
  poolAdmin,
  settings,
  liquidityAsset
}: DeployPoolProps) {
  const poolSettings = {
    ...DEFAULT_POOL_SETTINGS,
    ...settings
  };
  liquidityAsset = liquidityAsset ?? (await deployMockERC20()).mockERC20;
  const { operator, deployer } = await getCommonSigners();

  const { serviceConfiguration } = await deployServiceConfiguration();
  await serviceConfiguration
    .connect(operator)
    .setLiquidityAsset(liquidityAsset.address, true);

  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  const withdrawControllerFactory = await deployWithdrawControllerFactory(
    poolLib.address,
    serviceConfiguration.address
  );

  const poolControllerFactory = await deployPoolControllerFactory(
    poolLib.address,
    serviceConfiguration.address
  );

  const PoolFactory = await ethers.getContractFactory("PoolFactory", {
    signer: poolAdmin
  });
  const poolFactory = await PoolFactory.deploy(
    serviceConfiguration.address,
    withdrawControllerFactory.address,
    poolControllerFactory.address
  );
  await poolFactory.deployed();

  // Set Pool implementation on Factory
  const PoolImpl = await ethers.getContractFactory("Pool", {
    libraries: {
      PoolLib: poolLib.address
    }
  });
  const poolImpl = await PoolImpl.deploy();
  await poolFactory.connect(deployer).setImplementation(poolImpl.address);

  const txn = await poolFactory
    .connect(poolAdmin)
    .createPool(liquidityAsset.address, poolSettings);

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

  const poolController = await ethers.getContractAt(
    "PoolController",
    await pool.poolController()
  );

  return {
    pool,
    poolLib,
    poolFactory,
    liquidityAsset,
    serviceConfiguration,
    withdrawController,
    poolController
  };
}

/**
 * Deploy an "Initialized" Pool
 */
export async function deployPermissionedPool({
  poolAdmin,
  settings,
  liquidityAsset
}: DeployPoolProps) {
  const { operator, deployer } = await getCommonSigners();
  const poolSettings = {
    ...DEFAULT_POOL_SETTINGS,
    ...settings
  };
  liquidityAsset = liquidityAsset ?? (await deployMockERC20()).mockERC20;
  const {
    serviceConfiguration,
    tosAcceptanceRegistry,
    poolAdminAccessControl
  } = await deployPermissionedServiceConfiguration();

  await serviceConfiguration
    .connect(operator)
    .setLiquidityAsset(liquidityAsset.address, true);

  await tosAcceptanceRegistry.connect(poolAdmin).acceptTermsOfService();
  await performVeriteVerification(poolAdminAccessControl, operator, poolAdmin);

  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  // Deploy PoolAccessControlFactory, which is a dependency of PermissionedPoolFactory
  const PoolAccessControlFactory = await ethers.getContractFactory(
    "PoolAccessControlFactory"
  );
  const poolAccessControlFactory = await PoolAccessControlFactory.deploy(
    serviceConfiguration.address
  );

  const withdrawControllerFactory = await deployWithdrawControllerFactory(
    poolLib.address,
    serviceConfiguration.address
  );

  const poolControllerFactory = await deployPoolControllerFactory(
    poolLib.address,
    serviceConfiguration.address
  );

  const PoolFactory = await ethers.getContractFactory(
    "PermissionedPoolFactory",
    {
      signer: poolAdmin
    }
  );
  const poolFactory = await PoolFactory.deploy(
    serviceConfiguration.address,
    withdrawControllerFactory.address,
    poolControllerFactory.address,
    poolAccessControlFactory.address
  );
  await poolFactory.deployed();

  // Deploy PermissionedPool implementation contract
  const PermissionedPoolImpl = await ethers.getContractFactory(
    "PermissionedPool",
    {
      libraries: {
        PoolLib: poolLib.address
      }
    }
  );
  const permissionedPoolImpl = await PermissionedPoolImpl.deploy();
  await permissionedPoolImpl.deployed();

  // Set implementation on factory
  await poolFactory
    .connect(deployer)
    .setImplementation(permissionedPoolImpl.address);

  const txn = await poolFactory
    .connect(poolAdmin)
    .createPool(liquidityAsset.address, poolSettings);

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

  const poolController = await ethers.getContractAt(
    "PoolController",
    await pool.poolController()
  );

  const poolAccessControl = await ethers.getContractAt(
    "PoolAccessControl",
    await pool.poolAccessControl()
  );

  return {
    pool,
    liquidityAsset,
    serviceConfiguration,
    withdrawController,
    poolController,
    tosAcceptanceRegistry,
    poolAdminAccessControl,
    poolAccessControl
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

  const poolController = await ethers.getContractAt(
    "PoolController",
    await pool.poolController()
  );

  // Grant allowance
  await liquidityAsset
    .connect(poolAdmin)
    .approve(poolController.address, firstLossInitialMinimum);

  await poolController
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
      withdrawableAssets: 0,
      latestCrankPeriod: 0,
      crankOffsetPeriod: 0
    },
    overrides
  );
};

export async function deployWithdrawControllerFactory(
  poolLibAddress: string,
  serviceConfigAddress: string
) {
  const Factory = await ethers.getContractFactory("WithdrawControllerFactory", {
    libraries: {
      PoolLib: poolLibAddress
    }
  });
  const factory = await Factory.deploy(serviceConfigAddress);
  return factory.deployed();
}

export async function deployPoolControllerFactory(
  poolLibAddress: string,
  serviceConfigAddress: string
) {
  const Factory = await ethers.getContractFactory("PoolControllerFactory", {
    libraries: {
      PoolLib: poolLibAddress
    }
  });
  const factory = await Factory.deploy(serviceConfigAddress);
  return factory.deployed();
}

export async function progressWithdrawWindow(pool: any) {
  const { withdrawRequestPeriodDuration } = await pool.settings();
  await time.increase(withdrawRequestPeriodDuration);
}
