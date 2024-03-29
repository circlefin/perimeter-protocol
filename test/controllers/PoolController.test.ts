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
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "../support/erc20";
import {
  collateralizeLoan,
  deployLoan,
  fundLoan,
  DEFAULT_LOAN_SETTINGS
} from "../support/loan";
import {
  activatePool,
  DEFAULT_POOL_SETTINGS,
  deployPool,
  depositToPool
} from "../support/pool";
import { getCommonSigners } from "../support/utils";

describe("PoolController", () => {
  async function loadPoolFixture() {
    const {
      operator,
      deployer,
      pauser,
      poolAdmin,
      borrower,
      otherAccount,
      otherAccounts
    } = await getCommonSigners();

    const {
      pool,
      poolLib,
      poolControllerFactory,
      withdrawControllerFactory,
      liquidityAsset,
      poolController,
      serviceConfiguration,
      withdrawController
    } = await deployPool({
      poolAdmin: poolAdmin
    });

    const { mockERC20: collateralAsset } = await deployMockERC20();

    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    const { loan: otherLoan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    const { loan: openTermLoan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration,
      { loanType: 1 }
    );

    return {
      operator,
      pauser,
      deployer,
      poolAdmin,
      borrower,
      otherAccount,
      otherAccounts,
      serviceConfiguration,
      pool,
      poolLib,
      poolControllerFactory,
      withdrawControllerFactory,
      loan,
      otherLoan,
      liquidityAsset,
      collateralAsset,
      poolController,
      withdrawController,
      openTermLoan
    };
  }

  async function loadPoolFixtureWithFees() {
    const { poolAdmin, pauser, otherAccount } = await getCommonSigners();
    const { pool, poolController, liquidityAsset, serviceConfiguration } =
      await deployPool({
        poolAdmin,
        settings: { fixedFee: 100, fixedFeeInterval: 30 },
        pauser
      });

    const { loan } = await deployLoan(
      pool.address,
      otherAccount.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return {
      pool,
      poolController,
      liquidityAsset,
      poolAdmin,
      otherAccount,
      loan,
      serviceConfiguration,
      pauser
    };
  }

  async function loadPoolFixtureWithServiceFee() {
    const { poolAdmin, pauser, borrower, otherAccount } =
      await getCommonSigners();
    const { pool, poolController, liquidityAsset, serviceConfiguration } =
      await deployPool({
        poolAdmin,
        settings: { serviceFeeBps: 500 },
        pauser
      });

    const { loan } = await deployLoan(
      pool.address,
      borrower.address,
      liquidityAsset.address,
      serviceConfiguration
    );

    return {
      pool,
      poolController,
      liquidityAsset,
      poolAdmin,
      borrower,
      otherAccount,
      loan,
      serviceConfiguration,
      pauser
    };
  }

  describe("setRequestFee()", () => {
    it("sets the request fee in Bps", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await poolController.connect(poolAdmin).setRequestFee(1000);

      const settings = await poolController.settings();
      expect(settings.requestFeeBps).to.equal(1000);
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).setRequestFee(10_001)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("prevents setting a value that's too large", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await expect(
        poolController.connect(poolAdmin).setRequestFee(10_001)
      ).to.be.revertedWith("Pool: fee too large");
    });

    it("does not let anyone except the admin to set the fee", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await expect(
        poolController.connect(otherAccount).setRequestFee(10)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("does not allow setting the request fee once the pool is active", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestFeeBps).to.equal(500);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).setRequestFee(10)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });
  });

  describe("requestFee()", () => {
    it("returns the number of shares that will be charged to make this request", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await poolController.connect(poolAdmin).setRequestFee(500); // 5%

      expect(await poolController.requestFee(1_000)).to.equal(50);
    });
  });

  describe("setRequestCancellationFee()", () => {
    it("sets the request fee in Bps", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestCancellationFeeBps).to.equal(100);

      await poolController.connect(poolAdmin).setRequestCancellationFee(1000);

      const settings = await poolController.settings();
      expect(settings.requestCancellationFeeBps).to.equal(1000);
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).setRequestCancellationFee(100)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("does not let anyone except the admin to set the fee", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestCancellationFeeBps).to.equal(100);

      await expect(
        poolController.connect(otherAccount).setRequestCancellationFee(10)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("does not allow setting the request fee once the pool is active", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      const originalSettings = await poolController.settings();
      expect(originalSettings.requestCancellationFeeBps).to.equal(100);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).setRequestCancellationFee(10)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("does not allow setting a request cancellation fee that's too large", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await expect(
        poolController.connect(poolAdmin).setRequestCancellationFee(10_001)
      ).to.be.revertedWith("Pool: fee too large");
    });
  });

  describe("requestCancellationFee()", () => {
    it("returns the number of shares that will be charged to make this request", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await poolController.connect(poolAdmin).setRequestCancellationFee(500); // 5%

      expect(await poolController.requestCancellationFee(1_000)).to.equal(50);
    });
  });

  describe("setWithdrawGate()", () => {
    it("sets the withdraw gate in Bps", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      const originalSettings = await poolController.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      await poolController.connect(poolAdmin).setWithdrawGate(10);

      const settings = await poolController.settings();
      expect(settings.withdrawGateBps).to.equal(10);
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).setWithdrawGate(100)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("does not let anyone except the admin to set the withdraw gate", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const originalSettings = await poolController.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      await expect(
        poolController.connect(otherAccount).setWithdrawGate(10)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("does not allow setting the withdraw gate if the pool is paused", async () => {
      const {
        pool,
        poolController,
        poolAdmin,
        liquidityAsset,
        serviceConfiguration,
        pauser
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      const originalSettings = await poolController.settings();
      expect(originalSettings.withdrawGateBps).to.equal(10_000);

      // Pause the protocol
      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).setWithdrawGate(10)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("prevents setting a value too large ", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).setWithdrawGate(10_001)
      ).to.be.revertedWith("Pool: invalid bps");
    });
  });

  describe("withdrawGate()", () => {
    it("returns the current withdraw gate", async () => {
      const { poolController } = await loadFixture(loadPoolFixture);

      expect(await poolController.withdrawGate()).to.equal(10_000);
    });

    it("returns 100% if the pool is closed", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      await poolController.connect(poolAdmin).setWithdrawGate(0);

      expect(await poolController.withdrawGate()).to.equal(0);

      const now = await time.latest();
      // set pool end date
      await poolController.connect(poolAdmin).setPoolEndDate(now + 10);

      expect(await poolController.withdrawGate()).to.equal(0);
      expect(await poolController.state()).to.equal(1); // active

      // Move in the future
      await time.increaseTo(now + 20);

      expect(await poolController.state()).to.equal(2); // closed
      expect(await poolController.withdrawGate()).to.equal(10_000); // 100%
    });
  });

  describe("withdrawRequestPeriodDuration()", () => {
    it("returns the value set by PA", async () => {
      const { poolController } = await loadFixture(loadPoolFixture);

      expect(await poolController.withdrawRequestPeriodDuration()).to.equal(
        DEFAULT_POOL_SETTINGS.withdrawRequestPeriodDuration
      );
    });

    it("if the pool is closed, the withdraw window shrinks to 1 day", async () => {
      const { poolController } = await loadFixture(loadPoolFixture);

      const { endDate } = await poolController.settings();
      await time.increaseTo(endDate);

      expect(await poolController.state()).to.equal(2); // sanity check its closed
      expect(await poolController.withdrawRequestPeriodDuration()).to.equal(
        86400
      ); // 1 day
    });

    it("if the pool is closed, the withdraw window won't increase if it's already less than 1 day", async () => {
      const { poolAdmin } = await loadFixture(loadPoolFixture);

      const overriddenPoolSettings = {
        withdrawRequestPeriodDuration: 86399
      };

      const { poolController: newPoolController } = await deployPool({
        poolAdmin: poolAdmin,
        settings: overriddenPoolSettings
      });

      const { endDate } = await newPoolController.settings();
      await time.increaseTo(endDate);

      expect(await newPoolController.state()).to.equal(2); // sanity check its closed
      expect(await newPoolController.withdrawRequestPeriodDuration()).to.equal(
        overriddenPoolSettings.withdrawRequestPeriodDuration
      ); // Unchanged
    });
  });

  describe("setPoolCapacity()", () => {
    it("prevents setting capacity to less than current pool size", async () => {
      const { pool, poolController, otherAccount, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await expect(
        poolController.connect(poolAdmin).setPoolCapacity(1)
      ).to.be.revertedWith("Pool: invalid capacity");
    });

    it("allows setting pool capacity", async () => {
      const { pool, poolController, otherAccount, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 100);
      await expect(
        poolController.connect(poolAdmin).setPoolCapacity(101)
      ).to.emit(poolController, "PoolSettingsUpdated");

      expect((await poolController.settings()).maxCapacity).to.equal(101);
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).setPoolCapacity(101)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).setPoolCapacity(1)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("setPoolEndDate()", () => {
    it("reverts if trying to move up end date", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const newEndDate = (await poolController.settings()).endDate.add(1);

      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(newEndDate)
      ).to.be.revertedWith("Pool: can't move end date up");
    });

    it("reverts if trying to set end date to be in the past", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const now = await time.latest();

      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(now)
      ).to.be.revertedWith("Pool: can't move end date into the past");
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      const newEndDate = (await poolController.settings()).endDate.sub(1);
      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(newEndDate)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("allows moving up the pool end date", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const newEndDate = (await poolController.settings()).endDate.sub(1);

      await expect(
        poolController.connect(poolAdmin).setPoolEndDate(newEndDate)
      ).to.emit(poolController, "PoolSettingsUpdated");

      expect((await poolController.settings()).endDate).to.equal(newEndDate);
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).setPoolEndDate(1)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("setServiceFeeBps()", () => {
    it("allows change the pool service fee", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      expect((await poolController.settings()).serviceFeeBps).to.equal(0);

      const tx = poolController.connect(poolAdmin).setServiceFeeBps(500);

      await expect(tx).to.emit(poolController, "PoolSettingsUpdated");
      expect((await poolController.settings()).serviceFeeBps).to.equal(500);
    });

    it("reverts if set above 10,000", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const tx = poolController.connect(poolAdmin).setServiceFeeBps(10_000);
      await expect(tx).to.not.be.reverted;

      const tx2 = poolController.connect(poolAdmin).setServiceFeeBps(10_001);
      await expect(tx2).to.be.revertedWith("Pool: invalid service fee");
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const tx = poolController.connect(otherAccount).setServiceFeeBps(0);
      await expect(tx).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("setFixedFee()", () => {
    it("changes the pool fixed fee", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      expect((await poolController.settings()).fixedFee).to.equal(0);
      expect((await poolController.settings()).fixedFeeInterval).to.equal(0);

      const tx = poolController.connect(poolAdmin).setFixedFee(100, 1);

      await expect(tx).to.emit(poolController, "PoolSettingsUpdated");
      expect((await poolController.settings()).fixedFee).to.equal(100);
      expect((await poolController.settings()).fixedFeeInterval).to.equal(1);
    });

    it("reverts if the amount is greater than 0 and the interval is 0", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      const tx = poolController.connect(poolAdmin).setFixedFee(100, 0);

      await expect(tx).to.be.revertedWith("Pool: invalid fixed fee");
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      const tx = poolController.connect(otherAccount).setFixedFee(100, 1);
      await expect(tx).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("state()", () => {
    it("is closed when pool end date passes", async () => {
      const { poolController } = await loadFixture(loadPoolFixture);

      expect(await poolController.state()).to.equal(0); // initialized

      const poolEndDate = (await poolController.settings()).endDate;
      await time.increaseTo(poolEndDate);

      expect(await poolController.state()).to.equal(2); // closed
    });
  });
  describe("depositFirstLoss()", async () => {
    it("first loss can be deposited and transitions lifecycle state", async () => {
      const { poolController, poolAdmin, liquidityAsset } = await loadFixture(
        loadPoolFixture
      );

      const { firstLossInitialMinimum: firstLossAmount } =
        await poolController.settings();

      // Grant allowance
      await liquidityAsset
        .connect(poolAdmin)
        .approve(poolController.address, firstLossAmount);

      // Contribute first loss
      await expect(
        poolController
          .connect(poolAdmin)
          .depositFirstLoss(firstLossAmount, poolAdmin.address)
      ).to.emit(poolController, "FirstLossDeposited");

      // Check balance
      expect(await poolController.firstLossBalance()).to.equal(firstLossAmount);

      // Check lifecycle
      expect(await poolController.state()).to.equal(1); // Enum values are treated as ints
    });

    it("reverts if the protocol is paused", async () => {
      const {
        poolController,
        poolAdmin,
        liquidityAsset,
        serviceConfiguration,
        pauser
      } = await loadFixture(loadPoolFixture);

      const { firstLossInitialMinimum: firstLossAmount } =
        await poolController.settings();

      // Grant allowance
      await liquidityAsset
        .connect(poolAdmin)
        .approve(poolController.address, firstLossAmount);

      await serviceConfiguration.connect(pauser).setPaused(true);

      // Contribute first loss
      await expect(
        poolController
          .connect(poolAdmin)
          .depositFirstLoss(firstLossAmount, poolAdmin.address)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController
          .connect(otherAccount)
          .depositFirstLoss(100, otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("withdrawFirstLoss()", async () => {
    it("reverts if protocol is paused", async () => {
      const {
        pool,
        poolController,
        poolAdmin,
        borrower,
        loan,
        otherAccount,
        liquidityAsset,
        serviceConfiguration,
        pauser
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Pay down loan
      // Give borrower arbitrary amount to fully paydown loan
      const borrowerExcessAmount = (await loan.principal()).mul(2);
      await liquidityAsset.mint(borrower.address, borrowerExcessAmount);
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, borrowerExcessAmount);
      await loan.connect(borrower).completeFullPayment();

      // Fast forward to pool enddate
      await time.increaseTo(await (await pool.settings()).endDate);

      // First loss available
      const firstLossAmt = await poolController.firstLossBalance();

      // Pause protocol
      await serviceConfiguration.connect(pauser).setPaused(true);

      const tx = poolController
        .connect(poolAdmin)
        .withdrawFirstLoss(firstLossAmt, poolAdmin.address);

      await expect(tx).to.be.revertedWith("Pool: Protocol paused");
    });

    it("reverts if pool is not closed", async () => {
      const { poolController, poolAdmin } = await loadFixture(loadPoolFixture);

      await expect(
        poolController
          .connect(poolAdmin)
          .withdrawFirstLoss(10, poolAdmin.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if pool is closed, but there are still active loans", async () => {
      const {
        pool,
        poolController,
        poolAdmin,
        borrower,
        loan,
        otherAccount,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward past pool close
      await time.increaseTo((await pool.settings()).endDate);
      expect(await poolController.state()).to.equal(2); // Closed

      await expect(
        poolController
          .connect(poolAdmin)
          .withdrawFirstLoss(10, poolAdmin.address)
      ).to.be.revertedWith("Pool: loans still active");
    });

    it("can withdraw first loss to a receiver", async () => {
      const {
        pool,
        poolController,
        poolAdmin,
        borrower,
        loan,
        otherAccount,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Pay down loan
      // Give borrower arbitrary amount to fully paydown loan
      const borrowerExcessAmount = (await loan.principal()).mul(2);
      await liquidityAsset.mint(borrower.address, borrowerExcessAmount);
      await liquidityAsset
        .connect(borrower)
        .approve(loan.address, borrowerExcessAmount);
      await loan.connect(borrower).completeFullPayment();

      // Fast forward to pool enddate
      await time.increaseTo(await (await pool.settings()).endDate);

      // First loss available
      const firstLossAmt = await poolController.firstLossBalance();
      const firstLossVault = await poolController.firstLossVault();
      const txn = await poolController
        .connect(poolAdmin)
        .withdrawFirstLoss(firstLossAmt, poolAdmin.address);
      await txn.wait();

      expect(txn)
        .to.emit(poolController, "FirstLossWithdrawn")
        .withArgs(poolAdmin.address, poolAdmin.address, firstLossAmt);

      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        poolAdmin.address,
        +firstLossAmt
      );
      await expect(txn).to.changeTokenBalance(
        liquidityAsset,
        firstLossVault,
        -firstLossAmt
      );
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController
          .connect(otherAccount)
          .withdrawFirstLoss(100, otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("fundLoan()", () => {
    it("reverts if pool is not active", async () => {
      const { poolController, otherAccount, poolAdmin } = await loadFixture(
        loadPoolFixture
      );

      expect(await poolController.state()).to.equal(0); // initialized

      await expect(
        poolController.connect(poolAdmin).fundLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan address is not recognized", async () => {
      const { pool, poolController, liquidityAsset, otherAccount, poolAdmin } =
        await loadFixture(loadPoolFixture);

      expect(await poolController.state()).to.equal(0); // initialized
      await activatePool(pool, poolAdmin, liquidityAsset);

      await expect(
        poolController.connect(poolAdmin).fundLoan(otherAccount.address)
      ).to.be.reverted;
    });

    it("funds the loan from pool liquidity", async () => {
      const {
        pool,
        poolController,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);

      const txn = await poolController
        .connect(poolAdmin)
        .fundLoan(loan.address);

      expect(txn).to.changeTokenBalance(
        liquidityAsset,
        pool,
        -DEFAULT_LOAN_SETTINGS.principal
      );
      expect(txn).to.changeEtherBalance(
        liquidityAsset,
        loan,
        +DEFAULT_LOAN_SETTINGS.principal
      );
    });

    it("reverts if the protocol is paused", async () => {
      const {
        pool,
        poolController,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan,
        serviceConfiguration,
        pauser
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal
      );
      await collateralizeLoan(loan, borrower, liquidityAsset);

      // Pause protocol
      await serviceConfiguration.connect(pauser).setPaused(true);

      const tx = poolController.connect(poolAdmin).fundLoan(loan.address);

      await expect(tx).to.be.revertedWith("Pool: Protocol paused");
    });

    it("reverts if trying to fund loan with withdrawal-earmarked funds", async () => {
      const {
        pool,
        poolController,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal * 2
      );

      // Now request withdraw
      const redeemAmount = await pool.maxRedeemRequest(otherAccount.address);
      await pool.connect(otherAccount).requestRedeem(redeemAmount);

      // fast forward and snapshot
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);
      await pool.snapshot();
      await pool.connect(otherAccount).claimSnapshots(100);

      // double check that the funds are now available for withdraw
      expect(await pool.maxRedeem(otherAccount.address)).to.equal(redeemAmount);

      // check that totalAvailableAssets is dust
      expect(await pool.totalAvailableAssets()).to.lessThan(10);

      // Check that there is technically enough funds to cover the loan
      expect(await liquidityAsset.balanceOf(pool.address)).is.greaterThan(
        await loan.principal()
      );

      // ...but that the pool won't allow it
      await expect(
        poolController.connect(poolAdmin).fundLoan(loan.address)
      ).to.be.revertedWith("Pool: not enough assets");
    });

    it("reverts if trying to fund loan with liquidity already deployed", async () => {
      const {
        pool,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan,
        otherLoan,
        poolController
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal * 1.5
      );

      // fund first loan
      expect(await pool.totalAvailableAssets()).to.equal(
        DEFAULT_LOAN_SETTINGS.principal * 1.5
      );
      await fundLoan(loan, poolController, poolAdmin);

      // total value locked by the Pool is the same, since the funds just shifted to the loan
      expect(await pool.totalAvailableAssets()).to.equal(
        DEFAULT_LOAN_SETTINGS.principal * 1.5
      );

      // confirm that funding a new loan will fail
      await expect(
        poolController.connect(poolAdmin).fundLoan(otherLoan.address)
      ).to.be.revertedWith("Pool: not enough assets");
    });

    it("reverts if not called by Pool Controller", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).fundLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if trying to fund the same loan again", async () => {
      const {
        pool,
        liquidityAsset,
        otherAccount,
        borrower,
        poolAdmin,
        loan,
        poolController
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        DEFAULT_LOAN_SETTINGS.principal * 3
      );

      // fund loan 1 time
      await fundLoan(loan, poolController, poolAdmin);

      // Try again, even though there's technically enough money to cover the loan
      await expect(
        poolController.connect(poolAdmin).fundLoan(loan.address)
      ).to.be.revertedWith("Pool: already funded");
    });
  });

  describe("defaultLoan()", () => {
    it("reverts if Pool state is initialized", async () => {
      const { poolController, poolAdmin, loan } = await loadFixture(
        loadPoolFixture
      );
      await expect(
        poolController.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: FunctionInvalidAtThisLifeCycleState");
    });

    it("reverts if loan if Pool hasn't funded loan yet", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset, loan } =
        await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);
      await expect(
        poolController.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: not active loan");
    });

    it("reverts if the protocol is paused", async () => {
      const {
        collateralAsset,
        pool,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount,
        poolController,
        serviceConfiguration,
        pauser
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Collateralize loan
      await collateralizeLoan(loan, borrower, collateralAsset);

      // Deposit to pool and fund loan
      const loanPrincipal = await loan.principal();
      await depositToPool(pool, otherAccount, liquidityAsset, loanPrincipal);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Pause protocol
      await serviceConfiguration.connect(pauser).setPaused(true);

      // Trigger default
      await expect(
        poolController.connect(poolAdmin).defaultLoan(loan.address)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("defaults loan if loan is active, and pool is active", async () => {
      const {
        collateralAsset,
        pool,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount,
        poolController
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Collateralize loan
      await collateralizeLoan(loan, borrower, collateralAsset);

      // Deposit to pool and fund loan
      const loanPrincipal = await loan.principal();
      await depositToPool(pool, otherAccount, liquidityAsset, loanPrincipal);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Confirm that pool liquidity reserve is now empty
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(0);

      // Get an accounting snapshot prior to the default
      const outstandingLoanPrincipalsBefore = (await pool.accountings())
        .outstandingLoanPrincipals;
      const firstLossAvailable = await poolController.firstLossBalance();
      const loanOustandingDebt = loanPrincipal;

      // Confirm that first loss is NOT enough to cover the outstanding loan debt
      expect(firstLossAvailable).to.be.lessThan(loanOustandingDebt);

      // Trigger default
      // Since first-loss is not enough to cover outstanding debt, all of it is used
      await expect(poolController.connect(poolAdmin).defaultLoan(loan.address))
        .to.emit(poolController, "LoanDefaulted")
        .withArgs(loan.address)
        .to.emit(poolController, "FirstLossApplied")
        .withArgs(loan.address, firstLossAvailable);

      // Check accountings after
      // Pool accountings should be updated
      expect((await pool.accountings()).outstandingLoanPrincipals).is.equal(
        outstandingLoanPrincipalsBefore.sub(loanPrincipal)
      );

      // First loss vault should be empty
      expect(await poolController.firstLossBalance()).to.equal(0);

      // Pool liquidity reserve should now contain the first loss
      expect(await liquidityAsset.balanceOf(pool.address)).to.equal(
        firstLossAvailable
      );
    });

    it("defaults update totalDefaults and totalFirstLossApplied in Pool accountings", async () => {
      const {
        collateralAsset,
        pool,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount,
        poolController
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Collateralize loan
      await collateralizeLoan(loan, borrower, collateralAsset);

      // Deposit to pool and fund loan
      const loanPrincipal = await loan.principal();
      await depositToPool(pool, otherAccount, liquidityAsset, loanPrincipal);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Check accountings
      expect((await pool.accountings()).totalDefaults).to.equal(0);
      expect((await pool.accountings()).totalFirstLossApplied).to.equal(0);

      await poolController.connect(poolAdmin).defaultLoan(loan.address);
      expect((await pool.accountings()).totalDefaults).to.equal(
        await loan.principal()
      );
      // FL is only 100k, whereas loan principal is 1M.
      expect((await pool.accountings()).totalFirstLossApplied).to.equal(
        DEFAULT_POOL_SETTINGS.firstLossInitialMinimum
      );
    });

    it("defaults only supply first loss to cover outstanding loan principal", async () => {
      const {
        pool,
        poolAdmin,
        liquidityAsset,
        openTermLoan,
        borrower,
        otherAccount,
        poolController
      } = await loadFixture(loadPoolFixture);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Deposit to pool and fund loan
      await depositToPool(pool, otherAccount, liquidityAsset, 1_000_000);
      await fundLoan(openTermLoan, poolController, poolAdmin);

      await openTermLoan.connect(borrower).drawdown(500_000); // drawdown half

      // Deposit enough FL to cover full loan principal
      await liquidityAsset.mint(poolAdmin.address, 900_000);
      await liquidityAsset
        .connect(poolAdmin)
        .approve(poolController.address, 900_000);
      await poolController
        .connect(poolAdmin)
        .depositFirstLoss(900_000, poolAdmin.address);

      expect(await poolController.firstLossBalance()).to.equal(1_000_000);

      // Trigger default
      const txn = await poolController
        .connect(poolAdmin)
        .defaultLoan(openTermLoan.address);

      // Check that 500k moved from vault to pool
      await expect(txn)
        .to.changeTokenBalance(
          liquidityAsset,
          await pool.firstLossVault(),
          -500_000
        )
        .to.changeTokenBalance(liquidityAsset, pool.address, +500_000);

      await expect(txn).to.emit(poolController, "FirstLossApplied").withArgs(
        openTermLoan.address,
        500_000 // outstanding principal
      );
    });

    it("Allows defaults even if pool is closed", async () => {
      const {
        collateralAsset,
        pool,
        poolController,
        poolAdmin,
        liquidityAsset,
        loan,
        borrower,
        otherAccount
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await collateralizeLoan(loan, borrower, collateralAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Fast forward to pool end date
      await time.increaseTo((await pool.settings()).endDate);
      expect(await pool.state()).to.equal(2); // Closed

      // Default should proceed
      await expect(poolController.connect(poolAdmin).defaultLoan(loan.address))
        .not.to.be.reverted;
    });

    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).defaultLoan(otherAccount.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });
  });

  describe("snapshot()", () => {
    it("reverts if not called by Pool Admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).snapshot()
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if the protocol is paused", async () => {
      const {
        poolController,
        pool,
        poolAdmin,
        liquidityAsset,
        serviceConfiguration,
        pauser
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);

      // Pause protocol
      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).snapshot()
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("snapshots the pool", async () => {
      const { poolController, pool, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      const { withdrawRequestPeriodDuration } = await pool.settings();
      await time.increase(withdrawRequestPeriodDuration);
      await expect(poolController.connect(poolAdmin).snapshot()).to.emit(
        pool,
        "PoolSnapshotted"
      );
    });
  });

  describe("fixed fees", () => {
    it("claiming fees is only available to the pool admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixtureWithFees
      );

      const tx = poolController.connect(otherAccount).claimFixedFee();
      await expect(tx).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixtureWithFees);

      await serviceConfiguration.connect(pauser).setPaused(true);

      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.be.revertedWith("Pool: Protocol paused");
    });

    it("cannot claim fees until they're due", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);
      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.revertedWith("Pool: fixed fee not due");
    });

    it("can claim fees when they're due", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 30 days
      await time.increase(30 * 96_400);

      // Claim Fees
      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);

      // Trying again will fail
      const tx2 = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx2).to.be.revertedWith("Pool: fixed fee not due");
    });

    it("can cumulatively claim fees when they're due", async () => {
      const { pool, poolController, poolAdmin, liquidityAsset } =
        await loadFixture(loadPoolFixtureWithFees);
      await activatePool(pool, poolAdmin, liquidityAsset);

      // Mint tokens to the liquidity reserve
      await liquidityAsset.mint(pool.address, 500_000);

      // Fast forward 60 days
      await time.increase(60 * 96_400);

      // Claim Fees
      const tx = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);

      const tx2 = poolController.connect(poolAdmin).claimFixedFee();
      await expect(tx2).to.changeTokenBalance(liquidityAsset, poolAdmin, 100);
    });
  });

  describe("withdraw accumulated fees", () => {
    it("claiming fees is only available to the pool admin", async () => {
      const { poolController, otherAccount } = await loadFixture(
        loadPoolFixtureWithServiceFee
      );

      const tx = poolController
        .connect(otherAccount)
        .withdrawFeeVault(1, otherAccount.address);
      await expect(tx).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if the protocol is paused", async () => {
      const { poolController, poolAdmin, serviceConfiguration, pauser } =
        await loadFixture(loadPoolFixtureWithServiceFee);

      await serviceConfiguration.connect(pauser).setPaused(true);

      const tx = poolController
        .connect(poolAdmin)
        .withdrawFeeVault(1, poolAdmin.address);
      await expect(tx).to.be.revertedWith("Pool: Protocol paused");
    });

    it("can withdraw accumulated fees", async () => {
      const {
        pool,
        loan,
        borrower,
        poolController,
        otherAccount,
        poolAdmin,
        liquidityAsset
      } = await loadFixture(loadPoolFixtureWithServiceFee);

      // Make payments on a loan to accumulate fees in the feevault

      // Fund loan + drawdown
      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(pool, otherAccount, liquidityAsset, 1_000_000);
      await fundLoan(loan, poolController, poolAdmin);
      await loan.connect(borrower).drawdown(await loan.principal());

      // Make first payment
      await time.increase(await loan.paymentPeriod());

      // 4166 interest payment
      // with 5% service fee sliced off for the FeeVault == 208
      await liquidityAsset.connect(borrower).approve(loan.address, 4166);
      await loan.connect(borrower).completeNextPayment();

      // Check that fees have accumulated...
      const feeVaultAddr = await pool.feeVault();
      const balance = await liquidityAsset.balanceOf(feeVaultAddr);
      expect(balance).to.equal(208);

      // Check that the PA can claim the fee
      const txn = await poolController
        .connect(poolAdmin)
        .withdrawFeeVault(208, poolAdmin.address);
      await expect(txn).to.not.be.reverted;

      // Check that the fee moved from the vault to the PA
      await expect(txn).to.changeTokenBalances(
        liquidityAsset,
        [poolAdmin.address, feeVaultAddr],
        [+208, -208]
      );

      // Vault should now be empty
      expect(await liquidityAsset.balanceOf(feeVaultAddr)).to.equal(0);
    });
  });

  describe("reclaimLoanFunds()", async () => {
    it("can only be called by the pool admin", async () => {
      const { loan, borrower, poolController } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(borrower).reclaimLoanFunds(loan.address, 0)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if paused", async () => {
      const { loan, pauser, poolController, serviceConfiguration, poolAdmin } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).reclaimLoanFunds(loan.address, 0)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("can reclaim funds", async () => {
      const {
        otherAccount,
        pool,
        poolController,
        poolAdmin,
        openTermLoan,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      // Set up Pool with open term loan
      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await openTermLoan.principal()
      );
      await fundLoan(openTermLoan, poolController, poolAdmin);

      // Reclaim funds
      const reclaimAmount = 10;
      const txn = await poolController
        .connect(poolAdmin)
        .reclaimLoanFunds(openTermLoan.address, reclaimAmount);
      const fundingVault = await openTermLoan.fundingVault();
      await expect(txn).to.changeTokenBalances(
        liquidityAsset,
        [fundingVault, pool.address],
        [-reclaimAmount, +reclaimAmount]
      );
    });

    it("triggers a snapshot of the pool", async () => {
      const {
        otherAccount,
        pool,
        poolController,
        poolAdmin,
        openTermLoan,
        liquidityAsset
      } = await loadFixture(loadPoolFixture);

      // Set up Pool with open term loan
      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await openTermLoan.principal()
      );
      await fundLoan(openTermLoan, poolController, poolAdmin);

      // Reclaim funds and see if a snapshot was triggered
      // Event is only emitted if a snapshot was actually taken
      const snapshotPeriod = (await pool.settings())
        .withdrawRequestPeriodDuration;
      await time.increase(snapshotPeriod);
      const txn = await poolController
        .connect(poolAdmin)
        .reclaimLoanFunds(openTermLoan.address, 0);
      await expect(txn).to.emit(pool, "PoolSnapshotted");
    });
  });

  describe("claimLoanCollateral()", async () => {
    it("can only be called by the pool admin", async () => {
      const { otherAccount, loan, poolController } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController
          .connect(otherAccount)
          .claimLoanCollateral(loan.address, [], [])
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if paused", async () => {
      const { loan, poolController, poolAdmin, pauser, serviceConfiguration } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController
          .connect(poolAdmin)
          .claimLoanCollateral(loan.address, [], [])
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("can claim collateral", async () => {
      const {
        poolAdmin,
        borrower,
        otherAccount,
        liquidityAsset,
        pool,
        poolController,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );

      // collateralize loan
      const collateralAmount = 10;
      await liquidityAsset.mint(borrower.address, collateralAmount);
      await collateralizeLoan(loan, borrower, liquidityAsset, collateralAmount);

      // Fund loan
      await fundLoan(loan, poolController, poolAdmin);

      // Drawdown to activate it
      await loan.connect(borrower).drawdown(await loan.principal());

      // Default loan
      await poolController.connect(poolAdmin).defaultLoan(loan.address);

      // PA can now claim collateral via PoolController
      const txn = await poolController
        .connect(poolAdmin)
        .claimLoanCollateral(loan.address, [liquidityAsset.address], []);

      const collateralLocker = await loan.collateralVault();
      await expect(txn).to.changeTokenBalances(
        liquidityAsset,
        [collateralLocker, poolAdmin.address],
        [-collateralAmount, +collateralAmount]
      );
    });

    it("triggers a snapshot of the pool", async () => {
      const {
        poolAdmin,
        borrower,
        otherAccount,
        liquidityAsset,
        pool,
        poolController,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );

      // collateralize loan
      const collateralAmount = 10;
      await liquidityAsset.mint(borrower.address, collateralAmount);
      await collateralizeLoan(loan, borrower, liquidityAsset, collateralAmount);

      // Fund loan
      await fundLoan(loan, poolController, poolAdmin);

      // Drawdown to activate it
      await loan.connect(borrower).drawdown(await loan.principal());

      // Default loan
      await poolController.connect(poolAdmin).defaultLoan(loan.address);

      await time.increase(
        (
          await pool.settings()
        ).withdrawRequestPeriodDuration
      );
      const txn = await poolController
        .connect(poolAdmin)
        .claimLoanCollateral(loan.address, [liquidityAsset.address], []);
      await expect(txn).to.emit(pool, "PoolSnapshotted");
    });
  });

  describe("cancelFundedLoan()", () => {
    it("can only be called by the pool admin", async () => {
      const { otherAccount, loan, poolController } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).cancelFundedLoan(loan.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if paused", async () => {
      const { loan, poolController, poolAdmin, pauser, serviceConfiguration } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).cancelFundedLoan(loan.address)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("can cancel funded loan", async () => {
      const {
        poolAdmin,
        otherAccount,
        liquidityAsset,
        pool,
        poolController,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );

      // Fund loan
      await fundLoan(loan, poolController, poolAdmin);

      // Advance to drop dead date
      // Note that depending on the subset of tests run, time.latest()
      // can either be before or after the dropdead timestamp, hence this conditional.
      const dropDeadTimestamp = await loan.dropDeadTimestamp();
      if ((await time.latest()) < dropDeadTimestamp.toNumber()) {
        await time.increaseTo(dropDeadTimestamp.toBigInt());
      }

      // Cancel loan
      await poolController.connect(poolAdmin).cancelFundedLoan(loan.address);
      expect(await loan.state()).to.equal(2); // canceled
    });

    it("triggers a snapshot of the pool", async () => {
      const {
        poolAdmin,
        otherAccount,
        liquidityAsset,
        pool,
        poolController,
        loan
      } = await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);
      await depositToPool(
        pool,
        otherAccount,
        liquidityAsset,
        await loan.principal()
      );

      // Fund loan
      await fundLoan(loan, poolController, poolAdmin);

      await time.increase(
        (
          await pool.settings()
        ).withdrawRequestPeriodDuration
      );
      const txn = await poolController
        .connect(poolAdmin)
        .cancelFundedLoan(loan.address);
      await expect(txn).to.emit(pool, "PoolSnapshotted");
    });
  });

  describe("markLoanCallback()", () => {
    it("can only be called by the pool admin", async () => {
      const { otherAccount, loan, poolController } = await loadFixture(
        loadPoolFixture
      );

      await expect(
        poolController.connect(otherAccount).markLoanCallback(loan.address)
      ).to.be.revertedWith("Pool: caller is not admin");
    });

    it("reverts if paused", async () => {
      const { loan, poolController, poolAdmin, pauser, serviceConfiguration } =
        await loadFixture(loadPoolFixture);

      await serviceConfiguration.connect(pauser).setPaused(true);

      await expect(
        poolController.connect(poolAdmin).markLoanCallback(loan.address)
      ).to.be.revertedWith("Pool: Protocol paused");
    });

    it("mark loan as called back", async () => {
      const { poolAdmin, poolController, loan } = await loadFixture(
        loadPoolFixture
      );
      const callbackTimestamp = await loan.callbackTimestamp();
      expect(callbackTimestamp).to.equal(0);

      await poolController.connect(poolAdmin).markLoanCallback(loan.address);
      expect(await loan.callbackTimestamp()).to.be.greaterThan(
        callbackTimestamp
      );
    });

    it("triggers a snapshot of the pool", async () => {
      const { poolAdmin, pool, poolController, liquidityAsset, loan } =
        await loadFixture(loadPoolFixture);

      await activatePool(pool, poolAdmin, liquidityAsset);

      await time.increase(
        (
          await pool.settings()
        ).withdrawRequestPeriodDuration
      );

      const txn = await poolController
        .connect(poolAdmin)
        .markLoanCallback(loan.address);
      await expect(txn).to.emit(pool, "PoolSnapshotted");
    });
  });

  describe("Upgrades", () => {
    it("Can be upgraded", async () => {
      const { poolController, poolLib, poolControllerFactory, deployer } =
        await loadFixture(loadPoolFixture);

      // new implementation
      const V2Impl = await ethers.getContractFactory("PoolControllerMockV2", {
        libraries: {
          PoolLib: poolLib.address
        }
      });
      const v2Impl = await V2Impl.deploy();
      await expect(
        poolControllerFactory
          .connect(deployer)
          .setImplementation(v2Impl.address)
      ).to.emit(poolControllerFactory, "ImplementationSet");

      // Check that it upgraded
      const poolControllerV2 = V2Impl.attach(poolController.address);
      expect(await poolControllerV2.foo()).to.be.true;
    });
  });
});
