import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployServiceConfiguration } from "../support/deploy";

describe("PoolAccessControl", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, poolManager, otherAccount] = await ethers.getSigners();

    // Deploy the PoolManagerAccessControl contract
    const { serviceConfiguration, poolManagerAccessControl } =
      await deployServiceConfiguration(operator);

    await poolManagerAccessControl.allow(poolManager.address);

    // Deploy the PoolManagerAccessControl contract
    const PoolAccessControl = await ethers.getContractFactory(
      "PoolAccessControl"
    );
    const poolAccessControl = await PoolAccessControl.deploy(
      serviceConfiguration.address
    );

    await poolAccessControl.deployed();

    return {
      poolAccessControl,
      poolManager,
      otherAccount
    };
  }

  describe("isValidLender()", () => {
    it("should return true if the lender is valid", async () => {
      const { poolAccessControl, poolManager, otherAccount } =
        await loadFixture(deployFixture);

      await poolAccessControl
        .connect(poolManager)
        .allowLender(otherAccount.address);

      expect(await poolAccessControl.isValidLender(otherAccount.address)).to.be
        .true;
    });

    it("should return false if the lender is not valid", async () => {
      const { poolAccessControl } = await loadFixture(deployFixture);

      const isValidLender = await poolAccessControl.isValidLender(
        "0x0000000000000000000000000000000000000000"
      );

      expect(isValidLender).to.be.false;
    });
  });

  describe("isValidBorrower()", () => {
    it("should return true if the borrower is valid", async () => {
      const { poolAccessControl, poolManager, otherAccount } =
        await loadFixture(deployFixture);

      await poolAccessControl
        .connect(poolManager)
        .allowBorrower(otherAccount.address);

      const isValidBorrower = await poolAccessControl.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.true;
    });

    it("should return false if the borrower is not valid", async () => {
      const { poolAccessControl } = await loadFixture(deployFixture);

      const isValidBorrower = await poolAccessControl.isValidBorrower(
        "0x0000000000000000000000000000000000000000"
      );

      expect(isValidBorrower).to.be.false;
    });
  });

  describe("allowLender()", () => {
    it("should allow a lender", async () => {
      const { poolAccessControl, poolManager, otherAccount } =
        await loadFixture(deployFixture);

      await poolAccessControl
        .connect(poolManager)
        .allowLender(otherAccount.address);

      const isValidLender = await poolAccessControl.isValidLender(
        otherAccount.address
      );
      expect(isValidLender).to.be.true;
    });

    describe("permissions", () => {
      it("reverts if not called by an approved Pool Manager", async () => {
        const { poolAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolAccessControl
            .connect(otherAccount)
            .allowLender(otherAccount.getAddress())
        ).to.be.revertedWith(
          "ServiceConfiguration: caller is not a pool manager"
        );
      });
    });

    describe("events", () => {
      it("should emit a AllowedLenderListUpdated event", async () => {
        const { poolAccessControl, poolManager, otherAccount } =
          await loadFixture(deployFixture);

        await expect(
          poolAccessControl
            .connect(poolManager)
            .allowLender(otherAccount.address)
        )
          .to.emit(poolAccessControl, "AllowedLenderListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("removeLender()", () => {
    it("should remove a lender", async () => {
      const { poolAccessControl, poolManager, otherAccount } =
        await loadFixture(deployFixture);

      await poolAccessControl
        .connect(poolManager)
        .allowLender(otherAccount.address);

      let isValidLender = await poolAccessControl.isValidLender(
        otherAccount.address
      );
      expect(isValidLender).to.be.true;

      await poolAccessControl
        .connect(poolManager)
        .removeLender(otherAccount.address);

      isValidLender = await poolAccessControl.isValidLender(
        otherAccount.address
      );
      expect(isValidLender).to.be.false;
    });

    describe("permissions", () => {
      it("reverts if not called by an approved Pool Manager", async () => {
        const { poolAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolAccessControl
            .connect(otherAccount)
            .removeLender(otherAccount.getAddress())
        ).to.be.revertedWith(
          "ServiceConfiguration: caller is not a pool manager"
        );
      });
    });

    describe("events", () => {
      it("should emit a AllowedLenderListUpdated event", async () => {
        const { poolAccessControl, poolManager, otherAccount } =
          await loadFixture(deployFixture);

        await expect(
          poolAccessControl
            .connect(poolManager)
            .removeLender(otherAccount.address)
        )
          .to.emit(poolAccessControl, "AllowedLenderListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });

  describe("allowBorrower()", () => {
    it("should allow a borrower", async () => {
      const { poolAccessControl, poolManager, otherAccount } =
        await loadFixture(deployFixture);

      await poolAccessControl
        .connect(poolManager)
        .allowBorrower(otherAccount.address);

      const isValidBorrower = await poolAccessControl.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.true;
    });

    describe("permissions", () => {
      it("reverts if not called by an approved Pool Manager", async () => {
        const { poolAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolAccessControl
            .connect(otherAccount)
            .allowBorrower(otherAccount.getAddress())
        ).to.be.revertedWith(
          "ServiceConfiguration: caller is not a pool manager"
        );
      });
    });

    describe("events", () => {
      it("should emit a AllowedBorrowerListUpdated event", async () => {
        const { poolAccessControl, poolManager, otherAccount } =
          await loadFixture(deployFixture);

        await expect(
          poolAccessControl
            .connect(poolManager)
            .allowBorrower(otherAccount.address)
        )
          .to.emit(poolAccessControl, "AllowedBorrowerListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("removeBorrower()", () => {
    it("should remove a borrower", async () => {
      const { poolAccessControl, poolManager, otherAccount } =
        await loadFixture(deployFixture);

      await poolAccessControl
        .connect(poolManager)
        .allowBorrower(otherAccount.address);

      let isValidBorrower = await poolAccessControl.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.true;

      await poolAccessControl
        .connect(poolManager)
        .removeBorrower(otherAccount.address);

      isValidBorrower = await poolAccessControl.isValidBorrower(
        otherAccount.address
      );
      expect(isValidBorrower).to.be.false;
    });

    describe("permissions", () => {
      it("reverts if not called by an approved Pool Manager", async () => {
        const { poolAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolAccessControl
            .connect(otherAccount)
            .removeBorrower(otherAccount.getAddress())
        ).to.be.revertedWith(
          "ServiceConfiguration: caller is not a pool manager"
        );
      });
    });

    describe("events", () => {
      it("should emit a AllowedBorrowerListUpdated event", async () => {
        const { poolAccessControl, poolManager, otherAccount } =
          await loadFixture(deployFixture);

        await expect(
          poolAccessControl
            .connect(poolManager)
            .removeBorrower(otherAccount.address)
        )
          .to.emit(poolAccessControl, "AllowedBorrowerListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });
});
