/*
 * Copyright (c) 2023, Circle Internet Financial Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ethers } from "hardhat";
import { deployVaultFactory } from "./pool";
import {
  deployServiceConfiguration,
  deployPermissionedServiceConfiguration
} from "./serviceconfiguration";
import { getCommonSigners } from "./utils";

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
  poolAddress: string,
  borrowerAddress: string,
  liquidityAssetAddress: string,
  existingServiceConfiguration: any = null,
  overriddenLoanTerms?: Partial<typeof DEFAULT_LOAN_SETTINGS>
) {
  const { serviceConfiguration } = await (existingServiceConfiguration == null
    ? deployServiceConfiguration()
    : {
      serviceConfiguration: existingServiceConfiguration
    });

  const { operator, deployer } = await getCommonSigners();

  await serviceConfiguration
    .connect(operator)
    .setLiquidityAsset(liquidityAssetAddress, true);

  const loanSettings = {
    ...DEFAULT_LOAN_SETTINGS,
    ...overriddenLoanTerms
  };

  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();

  const LoanImpl = await ethers.getContractFactory("Loan", {
    libraries: {
      LoanLib: loanLib.address
    }
  });
  const loanImpl = await LoanImpl.deploy();

  const vaultFactory = await deployVaultFactory(serviceConfiguration.address);

  const LoanFactory = await ethers.getContractFactory("LoanFactory");
  const loanFactory = await LoanFactory.deploy(
    serviceConfiguration.address,
    vaultFactory.address
  );
  await loanFactory.deployed();

  await serviceConfiguration
    .connect(operator)
    .setLoanFactory(loanFactory.address, true);

  await loanFactory.connect(deployer).setImplementation(loanImpl.address);

  const txn = await loanFactory.createLoan(
    borrowerAddress,
    poolAddress,
    liquidityAssetAddress,
    {
      loanType: loanSettings.loanType,
      principal: loanSettings.principal,
      apr: loanSettings.apr,
      duration: loanSettings.duration,
      paymentPeriod: loanSettings.paymentPeriod,
      dropDeadTimestamp: loanSettings.dropDeadTimestamp,
      latePayment: loanSettings.latePayment,
      originationBps: loanSettings.originationBps
    }
  );

  const txnReceipt = await txn.wait();

  const loanCreatedEvent = txnReceipt.events?.find(
    (e) => e.event == "LoanCreated"
  );
  const loanAddress = loanCreatedEvent?.args?.[0];
  const loan = await ethers.getContractAt("Loan", loanAddress);

  return { loan, loanFactory, serviceConfiguration, vaultFactory };
}

export async function deployPermissionedLoan(
  pool: any,
  borrower: any,
  liquidityAsset: any,
  existingServiceConfiguration: any = null,
  overriddenLoanTerms?: Partial<typeof DEFAULT_LOAN_SETTINGS>
) {
  const { operator, deployer } = await getCommonSigners();
  const { serviceConfiguration } = await (existingServiceConfiguration == null
    ? deployPermissionedServiceConfiguration()
    : {
      serviceConfiguration: existingServiceConfiguration
    });

  const vaultFactory = await deployVaultFactory(serviceConfiguration.address);

  await serviceConfiguration
    .connect(operator)
    .setLiquidityAsset(liquidityAsset, true);

  const loanSettings = {
    ...DEFAULT_LOAN_SETTINGS,
    ...overriddenLoanTerms
  };

  const LoanLib = await ethers.getContractFactory("LoanLib");
  const loanLib = await LoanLib.deploy();

  const LoanImpl = await ethers.getContractFactory("PermissionedLoan", {
    libraries: {
      LoanLib: loanLib.address
    }
  });
  const loanImpl = await LoanImpl.deploy();

  const PermissionedLoanFactory = await ethers.getContractFactory(
    "PermissionedLoanFactory"
  );

  const loanFactory = await PermissionedLoanFactory.deploy(
    serviceConfiguration.address,
    vaultFactory.address
  );
  await loanFactory.deployed();

  await serviceConfiguration
    .connect(operator)
    .setLoanFactory(loanFactory.address, true);

  await loanFactory.connect(deployer).setImplementation(loanImpl.address);

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

export async function fundLoan(loan: any, poolController: any, poolAdmin: any) {
  await poolController.connect(poolAdmin).fundLoan(loan.address);
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
