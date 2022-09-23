import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Loan", () => {
  const MOCK_LIQUIDITY_ADDRESS = "0x0000000000000000000000000000000000000001";

  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, borrower, other] = await ethers.getSigners();

    // Deploy the Service Configuration contract
    const ServiceConfiguration = await ethers.getContractFactory(
      "ServiceConfiguration",
      operator
    );
    const serviceConfiguration = await ServiceConfiguration.deploy();
    await serviceConfiguration.deployed();

    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    const poolFactory = await PoolFactory.deploy(serviceConfiguration.address);
    await poolFactory.deployed();

    const LoanFactory = await ethers.getContractFactory("LoanFactory");
    const loanFactory = await LoanFactory.deploy(serviceConfiguration.address);
    await loanFactory.deployed();

    // Create a pool
    const tx1 = await poolFactory.createPool(MOCK_LIQUIDITY_ADDRESS, 0, 0, 0);
    const tx1Receipt = await tx1.wait();

    // Extract its address from the PoolCreated event
    const poolCreatedEvent = findEventByName(tx1Receipt, "PoolCreated");
    const poolAddress = poolCreatedEvent?.args?.[0];
    const Pool = await ethers.getContractFactory("Pool");
    const pool = Pool.attach(poolAddress);

    // Create the Loan
    const tx2 = await loanFactory.connect(borrower).createLoan(poolAddress);
    const tx2Receipt = await tx2.wait();

    const loanCreatedEvent = findEventByName(tx2Receipt, "LoanCreated");
    const loanAddress = loanCreatedEvent?.args?.[0];
    const Loan = await ethers.getContractFactory("Loan");
    const loan = Loan.attach(loanAddress);

    return {
      pool,
      loan,
      operator,
      borrower,
      other
    };
  }

  describe("after initialization", () => {
    it("is initialized!", async () => {
      const { loan, borrower } = await loadFixture(deployFixture);
      expect(await loan.state()).to.equal(0);
      expect(await loan.borrower()).to.equal(borrower.address);
    });
  });

  describe("cancelRequested", () => {
    it("transitions Loan to canceled state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);

      expect(await loan.state()).to.equal(0);
      await expect(loan.cancelRequested()).not.to.be.reverted;
      expect(await loan.state()).to.equal(2);
    });

    it("reverts if not called by the borrower", async () => {
      const { loan, other } = await loadFixture(deployFixture);

      await expect(loan.connect(other).cancelRequested()).to.be.revertedWith(
        "Loan: caller is not borrower"
      );
    });
  });

  describe("fund", () => {
    it("transitions Loan to Funded state", async () => {
      const fixture = await loadFixture(deployFixture);
      let { loan } = fixture;
      const { borrower, pool } = fixture;

      // Connect as borrower
      loan = loan.connect(borrower);

      expect(await loan.state()).to.equal(0);
      await expect(loan.postFungibleCollateral()).not.to.be.reverted;
      expect(await loan.state()).to.equal(1);
      await expect(pool.fundLoan(loan.address)).not.to.be.reverted;
      expect(await loan.state()).to.equal(4);
    });

    it("reverts if not in the collateralized state", async () => {
      const { pool, loan } = await loadFixture(deployFixture);

      expect(await loan.state()).to.equal(0);
      await expect(pool.fundLoan(loan.address)).to.be.revertedWith(
        "Loan: FunctionInvalidAtThisILoanLifeCycleState"
      );
      expect(await loan.state()).to.equal(0);
    });

    it("reverts if not called by the pool", async () => {
      const { loan, borrower, other } = await loadFixture(deployFixture);

      expect(await loan.state()).to.equal(0);
      await expect(loan.connect(borrower).postFungibleCollateral()).not.to.be
        .reverted;
      expect(await loan.state()).to.equal(1);

      await expect(loan.connect(other).fund()).to.be.revertedWith(
        "Loan: caller is not pool"
      );
    });
  });

  const findEventByName = (receipt, name) => {
    return receipt.events?.find((event) => event.event == name);
  };
});
