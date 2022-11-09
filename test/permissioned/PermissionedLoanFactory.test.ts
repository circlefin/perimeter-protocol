import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import { DEFAULT_LOAN_SETTINGS } from "../support/loan";
import { deployToSAcceptanceRegistry } from "../support/tosacceptanceregistry";
import { findEventByName } from "../support/utils";

describe("PermissionedLoanFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, borrower, pool] = await ethers.getSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

    // Deploy the Service Configuration contract
    const PermissionedServiceConfiguration = await ethers.getContractFactory(
      "PermissionedServiceConfiguration",
      operator
    );

    const permissionedServiceConfiguration =
      await PermissionedServiceConfiguration.deploy();
    await permissionedServiceConfiguration.deployed();
    await permissionedServiceConfiguration
      .connect(operator)
      .setLiquidityAsset(liquidityAsset.address, true);

    // Deploy ToS Registry
    const { tosAcceptanceRegistry } = await deployToSAcceptanceRegistry(
      permissionedServiceConfiguration
    );

    // Configure ToS
    await permissionedServiceConfiguration
      .connect(operator)
      .setToSAcceptanceRegistry(tosAcceptanceRegistry.address);
    await tosAcceptanceRegistry
      .connect(operator)
      .updateTermsOfService("https://terms.example");

    // Deploy library for linking
    const LoanLib = await ethers.getContractFactory("LoanLib");
    const loanLib = await LoanLib.deploy();

    // Deploy the PermissionedPoolFactory
    const LoanFactory = await ethers.getContractFactory("LoanFactory", {
      libraries: {
        LoanLib: loanLib.address
      }
    });
    const loanFactory = await LoanFactory.deploy(
      permissionedServiceConfiguration.address
    );
    await loanFactory.deployed();

    return {
      loanFactory,
      operator,
      borrower,
      pool,
      liquidityAsset,
      tosAcceptanceRegistry,
      permissionedServiceConfiguration
    };
  }

  it("creates a loan", async () => {
    const {
      loanFactory,
      borrower,
      pool,
      liquidityAsset,
      tosAcceptanceRegistry
    } = await loadFixture(deployFixture);

    await tosAcceptanceRegistry.connect(borrower).acceptTermsOfService();

    const txn = await loanFactory
      .connect(borrower)
      .createLoan(
        borrower.address,
        pool.address,
        liquidityAsset.address,
        DEFAULT_LOAN_SETTINGS
      );

    expect(txn).to.emit(loanFactory, "LoanCreated");
    const txnReceipt = await txn.wait();

    const loanCreatedEvent = findEventByName(txnReceipt, "LoanCreated");
    const loanAddress = loanCreatedEvent?.args?.[0];

    expect(await loanFactory.isLoan(loanAddress)).to.be.true;
  });
});
