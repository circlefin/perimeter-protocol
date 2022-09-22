import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployServiceConfiguration } from "../support/deploy";

describe("PoolManagerAccessControl", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [operator, otherAccount] = await ethers.getSigners();

    // Deploy the PoolManagerAccessControl contract
    const { poolManagerAccessControl } = await deployServiceConfiguration(
      operator
    );

    // Deploy the MockVeriteVerificationRegistry contract
    const MockVeriteVerificationRegistry = await ethers.getContractFactory(
      "MockVeriteVerificationRegistry"
    );
    const mockVeriteVerificationRegistry =
      await MockVeriteVerificationRegistry.deploy();
    await mockVeriteVerificationRegistry.deployed();

    return {
      poolManagerAccessControl,
      mockVeriteVerificationRegistry,
      otherAccount
    };
  }

  describe("isAllowed()", () => {
    describe("without a verification registry", () => {
      it("returns false if the address is not in the allow list", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(
          await poolManagerAccessControl.isAllowed(otherAccount.address)
        ).to.equal(false);
      });

      it("returns true if the address is on the allow list", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerAccessControl.allow(otherAccount.address);

        expect(
          await poolManagerAccessControl.isAllowed(otherAccount.address)
        ).to.equal(true);
      });
    });

    describe("with a verification registry", () => {
      it("returns true if the address is on an allowList, even if not present in a VerificationRegistry", async () => {
        const {
          poolManagerAccessControl,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await poolManagerAccessControl.allow(otherAccount.address);
        await poolManagerAccessControl.setVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerAccessControl.isAllowed(otherAccount.address)
        ).to.equal(true);
      });

      it("returns true if the address is not in the allowList but is in the registry", async () => {
        const {
          poolManagerAccessControl,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await mockVeriteVerificationRegistry.setVerified(
          otherAccount.address,
          true
        );

        await poolManagerAccessControl.setVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerAccessControl.isAllowed(otherAccount.address)
        ).to.equal(true);
      });

      it("returns false if the address is not in the allowList and not in the registry", async () => {
        const {
          poolManagerAccessControl,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await poolManagerAccessControl.setVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerAccessControl.isAllowed(otherAccount.address)
        ).to.equal(false);
      });
    });
  });

  describe("allow()", () => {
    it("adds an address to the allowList", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerAccessControl.allow(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    it("succeeds if the address is already in the allowList", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerAccessControl.allow(otherAccount.address);
      await poolManagerAccessControl.allow(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolManagerAccessControl
            .connect(otherAccount)
            .allow(otherAccount.getAddress())
        ).to.be.revertedWith("ServiceConfiguration: caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon adding an address", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(await poolManagerAccessControl.allow(otherAccount.address))
          .to.emit(poolManagerAccessControl, "AllowListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("remove()", () => {
    it("removes an address from the allowList", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerAccessControl.remove(otherAccount.address);
      await poolManagerAccessControl.remove(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("succeeds if the address is not in the allowList", async () => {
      const { poolManagerAccessControl, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerAccessControl.remove(otherAccount.address);

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolManagerAccessControl
            .connect(otherAccount)
            .remove(otherAccount.getAddress())
        ).to.be.revertedWith("ServiceConfiguration: caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon removing an address", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerAccessControl.remove(otherAccount.address);

        await expect(poolManagerAccessControl.remove(otherAccount.address))
          .to.emit(poolManagerAccessControl, "AllowListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });

  describe("setVerificationRegistry()", () => {
    it("adds a registry to the registry list", async () => {
      const {
        poolManagerAccessControl,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await mockVeriteVerificationRegistry.setVerified(
        otherAccount.address,
        true
      );

      await poolManagerAccessControl.setVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolManagerAccessControl
            .connect(otherAccount)
            .setVerificationRegistry(otherAccount.getAddress())
        ).to.be.revertedWith("ServiceConfiguration: caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an VerificationRegistrySet event upon success", async () => {
        const { poolManagerAccessControl, mockVeriteVerificationRegistry } =
          await loadFixture(deployFixture);

        await expect(
          poolManagerAccessControl.setVerificationRegistry(
            mockVeriteVerificationRegistry.address
          )
        )
          .to.emit(poolManagerAccessControl, "VerificationRegistrySet")
          .withArgs(mockVeriteVerificationRegistry.address);
      });
    });
  });

  describe("removeVerificationRegistry()", () => {
    it("removes the registry", async () => {
      const {
        poolManagerAccessControl,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await mockVeriteVerificationRegistry.setVerified(
        otherAccount.address,
        true
      );

      await poolManagerAccessControl.setVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      await poolManagerAccessControl.removeVerificationRegistry();

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("silently succeeds when removing an address that is not present", async () => {
      const {
        poolManagerAccessControl,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await poolManagerAccessControl.setVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      // Deploy a new registry
      const MockVeriteVerificationRegistry = await ethers.getContractFactory(
        "MockVeriteVerificationRegistry"
      );
      const otherRegistry = await MockVeriteVerificationRegistry.deploy();
      await otherRegistry.deployed();

      await poolManagerAccessControl.removeVerificationRegistry();

      expect(
        await poolManagerAccessControl.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    describe("permissions", () => {
      it("reverts if not called by the ServiceConfiguration Operator role", async () => {
        const { poolManagerAccessControl, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          poolManagerAccessControl
            .connect(otherAccount)
            .removeVerificationRegistry()
        ).to.be.revertedWith("ServiceConfiguration: caller is not an operator");
      });
    });

    describe("events", () => {
      it("emits an VerificationRegistryRemoved event upon success", async () => {
        const { poolManagerAccessControl } = await loadFixture(deployFixture);

        await expect(
          poolManagerAccessControl.removeVerificationRegistry()
        ).to.emit(poolManagerAccessControl, "VerificationRegistryRemoved");
      });
    });
  });
});
