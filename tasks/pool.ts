import { task } from "hardhat/config";
import { ContractFactory } from "ethers";

task("getPoolState", "Reads the pools current lifecycle state")
  .addParam("pool", "Address of the pool")
  .setAction(async (taskArgs, hre) => {
    const Pool: ContractFactory = await hre.ethers.getContractFactory("Pool");
    const pool = Pool.attach(taskArgs.pool);
    const stateRaw = await pool.state();

    let state;
    if (stateRaw == 0) {
      state = "Initialized";
    } else if (stateRaw == 1) {
      state = "Active";
    } else if (stateRaw == 2) {
      state = "Paused";
    } else if (stateRaw == 3) {
      state = "Closed";
    }

    console.log("Pool state: ", state);
  });
