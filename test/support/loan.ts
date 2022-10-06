import { ethers } from "hardhat";
import { deployServiceConfiguration } from "./serviceconfiguration";

const SEVEN_DAYS = 6 * 60 * 60 * 24;

/**
 * Deploy a loan
 */
export async function deployLoan(
  pool: any,
  borrower: any,
  liquidityAsset: any,
  existingServiceConfiguration: any = null
) {
  const { serviceConfiguration } = await (existingServiceConfiguration == null
    ? deployServiceConfiguration()
    : {
        serviceConfiguration: existingServiceConfiguration
      });

  await serviceConfiguration.setLiquidityAsset(liquidityAsset, true);

  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();

  const LoanFactory = await ethers.getContractFactory("LoanFactory", {
    libraries: {
      LoanLib: loanLib.address
    }
  });
  const loanFactory = await LoanFactory.deploy(serviceConfiguration.address);
  await loanFactory.deployed();

  await serviceConfiguration.setLoanFactory(loanFactory.address, true);

  const txn = await loanFactory.createLoan(
    borrower,
    pool,
    180,
    30,
    0,
    500,
    liquidityAsset,
    1_000_000,
    Math.floor(Date.now() / 1000) + SEVEN_DAYS
  );

  const txnReceipt = await txn.wait();

  const loanCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "LoanCreated"
  );
  const loanAddress = loanCreatedEvent?.args?.[0];
  const loan = await ethers.getContractAt("Loan", loanAddress);

  return { loan, loanFactory, serviceConfiguration };
}

export async function collateralizeLoan(loan: any, borrower: any) {
  const CollateralAsset = await ethers.getContractFactory("MockERC20");
  const collateralAsset = await CollateralAsset.deploy(
    "Test Collateral Coin",
    "TCC"
  );
  await collateralAsset.deployed();

  await collateralAsset.mint(borrower.address, 1_000_000);
  await collateralAsset.connect(borrower).approve(loan.address, 100);
  await loan
    .connect(borrower)
    .postFungibleCollateral(collateralAsset.address, 100);

  return { loan, borrower, collateralAsset };
}

export async function fundLoan(loan: any, pool: any, pm: any) {
  await pool.connect(pm).fundLoan(loan.address);
}
