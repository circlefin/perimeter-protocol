import { task } from "hardhat/config";
import { ContractFactory } from "ethers";

task("createPool", "Create a new Pool from the PoolFactory")
  .addParam("factory", "Address of the PoolFactory")
  .addParam("privateKey", "Private signer key")
  .addParam("liquidityAsset", "Address of the pool liquidity asset")
  .addParam("maxCapacity", "Max Capacity of the pool")
  .addParam("endDate", "Pool end date, in epoch seconds")
  .addParam("requestFeeBps", "Withdraw request fee, bps")
  .addParam("requestCancellationFeeBps", "Request cancellation fee, bips")
  .addParam(
    "withdrawGateBps",
    "Bips, percent of liquidity pool available to withdraw"
  )
  .addParam(
    "serviceFeeBps",
    "Bips, percent taken from borrower payments to be paid to pool admin"
  )
  .addParam(
    "firstLossInitialMinimum",
    "Amount of tokens to be deposited to first loss before a pool is active"
  )
  .addParam("withdrawRequestPeriodDuration", "seconds")
  .addParam(
    "fixedFee",
    "Amount of tokens the pool admin can claim every interval"
  )
  .addParam(
    "fixedFeeInterval",
    "Interval in days at which a pool admin can claim fixed fees from the pool"
  )
  .setAction(async (taskArgs, hre) => {
    const PoolFactory: ContractFactory = await hre.ethers.getContractFactory(
      "PoolFactory"
    );
    const poolFactory = PoolFactory.attach(taskArgs.factory);
    const signer = new hre.ethers.Wallet(
      taskArgs.privateKey,
      hre.ethers.provider
    );

    const poolSettings = {
      maxCapacity: hre.ethers.BigNumber.from(taskArgs.maxCapacity),
      requestFeeBps: hre.ethers.BigNumber.from(taskArgs.requestFeeBps),
      requestCancellationFeeBps: hre.ethers.BigNumber.from(
        taskArgs.requestCancellationFeeBps
      ),
      withdrawGateBps: hre.ethers.BigNumber.from(taskArgs.withdrawGateBps),
      serviceFeeBps: hre.ethers.BigNumber.from(taskArgs.serviceFeeBps),
      firstLossInitialMinimum: hre.ethers.BigNumber.from(
        taskArgs.firstLossInitialMinimum
      ),
      withdrawRequestPeriodDuration: hre.ethers.BigNumber.from(
        taskArgs.withdrawRequestPeriodDuration
      ),
      fixedFee: hre.ethers.BigNumber.from(taskArgs.fixedFee),
      fixedFeeInterval: hre.ethers.BigNumber.from(taskArgs.fixedFeeInterval),
      endDate: hre.ethers.BigNumber.from(taskArgs.endDate)
    };

    const txn = await poolFactory
      .connect(signer)
      .createPool(taskArgs.liquidityAsset, poolSettings);

    const txnReceipt = await txn.wait();
    const poolCreatedEvent = txnReceipt.events?.find(
      (e: any) => e.event == "PoolCreated"
    );
    const poolAddress = poolCreatedEvent?.args?.[0];
    console.log("Pool address: ", poolAddress);
  });
