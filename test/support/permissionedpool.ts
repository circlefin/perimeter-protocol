import { ethers } from "hardhat";
import { deployMockERC20 } from "./erc20";
import { DEFAULT_POOL_SETTINGS } from "./pool";
import { deployServiceConfiguration } from "./serviceconfiguration";
import { deployToSAcceptanceRegistry } from "./tosacceptanceregistry";

/**
 * Deploy an "Initialized" Pool
 */
export async function deployPermissionedPool(
  poolManager: any,
  poolSettings = DEFAULT_POOL_SETTINGS
) {
  const { mockERC20: liquidityAsset } = await deployMockERC20();

  const { serviceConfiguration } = await deployServiceConfiguration();
  const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
    serviceConfiguration
  );
  await serviceConfiguration.setToSAcceptanceRegistry(
    tosAcceptanceRegistry.address
  );

  const PoolLib = await ethers.getContractFactory("PoolLib");
  const poolLib = await PoolLib.deploy();

  const PermissionedPool = await ethers.getContractFactory("PermissionedPool", {
    libraries: {
      PoolLib: poolLib.address
    }
  });

  const pool = await PermissionedPool.deploy(
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

  return { pool, liquidityAsset, tosAcceptanceRegistry };
}
