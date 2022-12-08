import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import { deployPermissionedPool, DEFAULT_POOL_SETTINGS } from "../support/pool";
import { DEFAULT_LOAN_SETTINGS } from "../support/loan";
import { findEventByName, getCommonSigners } from "../support/utils";

describe("PermissionedLoanFactory", () => {
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const { operator, poolAdmin, borrower, deployer } =
      await getCommonSigners();

    // Deploy the liquidity asset
    const { mockERC20: liquidityAsset } = await deployMockERC20();

    // Deploy PermissionedPool
    const {
      pool,
      tosAcceptanceRegistry,
      serviceConfiguration: permissionedServiceConfiguration
    } = await deployPermissionedPool({
      poolAdmin: poolAdmin,
      settings: DEFAULT_POOL_SETTINGS,
      liquidityAsset: liquidityAsset
    });

    await permissionedServiceConfiguration
      .connect(operator)
      .setLiquidityAsset(liquidityAsset.address, true);

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

    // Deploy the PermissionedLoanFactory
    const LoanFactory = await ethers.getContractFactory(
      "PermissionedLoanFactory"
    );
    const loanFactory = await LoanFactory.deploy(
      permissionedServiceConfiguration.address
    );
    await loanFactory.deployed();

    // Deployer PermissionedLoan implementation
    const PermissionedLoan = await ethers.getContractFactory(
      "PermissionedLoan",
      {
        libraries: {
          LoanLib: loanLib.address
        }
      }
    );
    const permissionedLoan = await PermissionedLoan.deploy();

    // Set implementation on factory
    await loanFactory
      .connect(deployer)
      .setImplementation(permissionedLoan.address);

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
