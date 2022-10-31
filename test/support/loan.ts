import { ethers } from "hardhat";
import { deployServiceConfiguration } from "./serviceconfiguration";

const SEVEN_DAYS = 6 * 60 * 60 * 24;

export const DEFAULT_LOAN_SETTINGS = {
  duration: 180,
  latePayment: 0,
  originationFee: 0
};

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
    30,
    0,
    500,
    liquidityAsset,
    1_000_000,
    Math.floor(Date.now() / 1000) + SEVEN_DAYS,
    {
      duration: 180,
      latePayment: 1_000,
      originationBps: 0
    }
  );

  const txnReceipt = await txn.wait();

  const loanCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "LoanCreated"
  );
  const loanAddress = loanCreatedEvent?.args?.[0];
  const loan = await ethers.getContractAt("Loan", loanAddress);

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
