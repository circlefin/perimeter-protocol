import { ethers } from "hardhat";
import {
  deployServiceConfiguration,
  deployPermissionedServiceConfiguration
} from "./serviceconfiguration";

const SEVEN_DAYS = 6 * 60 * 60 * 24;

export const DEFAULT_LOAN_SETTINGS = {
  duration: 180,
  paymentPeriod: 30,
  apr: 500,
  principal: 1_000_000,
  dropDeadTimestamp: Math.floor(Date.now() / 1000) + SEVEN_DAYS,
  latePaymentFee: 0,
  latePayment: 0,
  originationBps: 0,
  loanType: 0
};

/**
 * Deploy a loan
 */
export async function deployLoan(
  pool: any,
  borrower: any,
  liquidityAsset: any,
  existingServiceConfiguration: any = null,
  overriddenLoanTerms?: Partial<typeof DEFAULT_LOAN_SETTINGS>
) {
  const { serviceConfiguration } = await (existingServiceConfiguration == null
    ? deployServiceConfiguration()
    : {
        serviceConfiguration: existingServiceConfiguration
      });

  await serviceConfiguration.setLiquidityAsset(liquidityAsset, true);

  const loanSettings = {
    ...DEFAULT_LOAN_SETTINGS,
    ...overriddenLoanTerms
  };

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

  const txn = await loanFactory.createLoan(borrower, pool, liquidityAsset, {
    loanType: loanSettings.loanType,
    principal: loanSettings.principal,
    apr: loanSettings.apr,
    duration: loanSettings.duration,
    paymentPeriod: loanSettings.paymentPeriod,
    dropDeadTimestamp: loanSettings.dropDeadTimestamp,
    latePayment: loanSettings.latePayment,
    originationBps: loanSettings.originationBps
  });

  const txnReceipt = await txn.wait();

  const loanCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "LoanCreated"
  );
  const loanAddress = loanCreatedEvent?.args?.[0];
  const loan = await ethers.getContractAt("Loan", loanAddress);

  return { loan, loanFactory, serviceConfiguration };
}

export async function deployPermissionedLoan(
  pool: any,
  borrower: any,
  liquidityAsset: any,
  operator: any,
  existingServiceConfiguration: any = null,
  overriddenLoanTerms?: Partial<typeof DEFAULT_LOAN_SETTINGS>
) {
  const { serviceConfiguration } = await (existingServiceConfiguration == null
    ? deployPermissionedServiceConfiguration(operator)
    : {
        serviceConfiguration: existingServiceConfiguration
      });

  await serviceConfiguration
    .connect(operator)
    .setLiquidityAsset(liquidityAsset, true);

  const loanSettings = {
    ...DEFAULT_LOAN_SETTINGS,
    ...overriddenLoanTerms
  };

  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();

  const PermissionedLoanFactory = await ethers.getContractFactory(
    "PermissionedLoanFactory",
    {
      libraries: {
        LoanLib: loanLib.address
      }
    }
  );

  const loanFactory = await PermissionedLoanFactory.deploy(
    serviceConfiguration.address
  );
  await loanFactory.deployed();

  await serviceConfiguration.setLoanFactory(loanFactory.address, true);

  const txn = await loanFactory.createLoan(borrower, pool, liquidityAsset, {
    loanType: loanSettings.loanType,
    principal: loanSettings.principal,
    apr: loanSettings.apr,
    duration: loanSettings.duration,
    paymentPeriod: loanSettings.paymentPeriod,
    dropDeadTimestamp: loanSettings.dropDeadTimestamp,
    latePayment: loanSettings.latePayment,
    originationBps: loanSettings.originationBps
  });

  const txnReceipt = await txn.wait();

  const loanCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "LoanCreated"
  );
  const loanAddress = loanCreatedEvent?.args?.[0];
  const loan = await ethers.getContractAt("PermissionedLoan", loanAddress);

  return { loan, loanFactory, serviceConfiguration };
}

export async function collateralizeLoan(
  loan: any,
  borrower: any,
  fungibleAsset: any,
  fungibleAmount = 100
) {
  await fungibleAsset.mint(borrower.address, fungibleAmount);
  await fungibleAsset.connect(borrower).approve(loan.address, fungibleAmount);
  await loan
    .connect(borrower)
    .postFungibleCollateral(fungibleAsset.address, fungibleAmount);
  return { loan, borrower, fungibleAsset, fungibleAmount };
}

export async function collateralizeLoanNFT(loan: any, borrower: any, nft: any) {
  await nft.mint(borrower.address);
  const tokenId = await nft.tokenOfOwnerByIndex(borrower.address, 0);
  await nft.connect(borrower).approve(loan.address, tokenId);
  await loan.connect(borrower).postNonFungibleCollateral(nft.address, tokenId);
  return { loan, borrower, nft, tokenId };
}

export async function fundLoan(loan: any, pool: any, pm: any) {
  await pool.connect(pm).fundLoan(loan.address);
}

export async function matureLoan(
  loan: any,
  borrower: any,
  liquidityAsset: any
) {
  let fullPayment = await loan.principal(); // principal
  fullPayment = fullPayment.add(
    // plus all payments
    (await loan.paymentsRemaining()).mul(await loan.payment())
  );

  const borrowerBalance = await liquidityAsset.balanceOf(borrower.address);
  if (fullPayment > borrowerBalance) {
    await liquidityAsset.mint(borrower.address, fullPayment - borrowerBalance);
  }

  await liquidityAsset.connect(borrower).approve(loan.address, fullPayment);

  await loan.connect(borrower).completeFullPayment();
}
