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
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { activatePool, deployPool, deployVaultFactory } from "../support/pool";
import { DEFAULT_LOAN_SETTINGS } from "../support/loan";
import { getCommonSigners } from "../support/utils";
import { deployMockERC20 } from "../support/erc20";

describe("LoanFactory", () => {
  async function deployLoanFactoryFixture() {
    const { deployer, operator, pauser, poolAdmin, borrower } =
      await getCommonSigners();

    // Create a pool
    const { pool, liquidityAsset, serviceConfiguration } = await deployPool({
      poolAdmin: poolAdmin,
      pauser
    });

    // Create a difference ERC20
    const { mockERC20: otherMockERC2O } = await deployMockERC20(
      "OtherTestToken",
      "OTT"
    );

    await activatePool(pool, poolAdmin, liquidityAsset);

    const LoanLib = await ethers.getContractFactory("LoanLib");
    const loanLib = await LoanLib.deploy();

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

    // Deploy Loan implementation contract
    const LoanImpl = await ethers.getContractFactory("Loan", {
      libraries: {
        LoanLib: loanLib.address
      }
    });
    const loanImpl = await LoanImpl.deploy();

    // Set implementation on the LoanFactory
    await loanFactory.connect(deployer).setImplementation(loanImpl.address);

    return {
      loanFactory,
      borrower,
      pool,
      liquidityAsset,
      otherMockERC2O,
      serviceConfiguration,
      operator
    };
  }

  describe("createLoan()", () => {
    it("reverts if liquidity asset doesn't match the pool", async () => {
      const {
        loanFactory,
        borrower,
        pool,
        otherMockERC2O,
        serviceConfiguration,
        operator
      } = await loadFixture(deployLoanFactoryFixture);

      // Set otherMockERC20 as a supported currency in the protocol
      // However, it's still mismatched with the pool, so we expect creating the loan to fail
      await serviceConfiguration
        .connect(operator)
        .setLiquidityAsset(otherMockERC2O.address, true);
      expect(await pool.asset()).to.not.equal(otherMockERC2O.address);

      await expect(
        loanFactory.createLoan(
          borrower.address,
          pool.address,
          otherMockERC2O.address,
          DEFAULT_LOAN_SETTINGS
        )
      ).to.be.revertedWith("LoanLib: Not allowed asset for pool");
    });
  });
});
