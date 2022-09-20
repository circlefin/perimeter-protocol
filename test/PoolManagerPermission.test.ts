import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PoolManagerPermission", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [otherAccount] = await ethers.getSigners();

    // Deploy the PoolManagerPermission contract
    const PoolManagerPermission = await ethers.getContractFactory(
      "PoolManagerPermission"
    );
    const poolManagerPermission = await PoolManagerPermission.deploy();
    await poolManagerPermission.deployed();

    // Deploy the MockVeriteVerificationRegistry contract
    const MockVeriteVerificationRegistry = await ethers.getContractFactory(
      "MockVeriteVerificationRegistry"
    );
    const mockVeriteVerificationRegistry =
      await MockVeriteVerificationRegistry.deploy();
    await mockVeriteVerificationRegistry.deployed();

    return {
      poolManagerPermission,
      mockVeriteVerificationRegistry,
      otherAccount
    };
  }

  describe("isAllowed()", () => {
    describe("without a verification registry", () => {
      it("returns false if the address is not in the allow list", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.address)
        ).to.equal(false);
      });

      it("returns true if the address is on the allow list", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerPermission.allow(otherAccount.address);

        expect(
          await poolManagerPermission.isAllowed(otherAccount.address)
        ).to.equal(true);
      });
    });

    describe("with a verification registry", () => {
      it("returns true if the address is on an allowList, even if not present in a VerificationRegistry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await poolManagerPermission.allow(otherAccount.address);
        await poolManagerPermission.setVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.address)
        ).to.equal(true);
      });

      it("returns true if the address is not in the allowList but is in the registry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await mockVeriteVerificationRegistry.setVerified(
          otherAccount.address,
          true
        );

        await poolManagerPermission.setVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.address)
        ).to.equal(true);
      });

      it("returns false if the address is not in the allowList and not in the registry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await poolManagerPermission.setVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.address)
        ).to.equal(false);
      });
    });
  });

  describe("allow()", () => {
    it("adds an address to the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.allow(otherAccount.address);

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    it("succeeds if the address is already in the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.allow(otherAccount.address);
      await poolManagerPermission.allow(otherAccount.address);

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon adding an address", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(await poolManagerPermission.allow(otherAccount.address))
          .to.emit(poolManagerPermission, "AllowListUpdated")
          .withArgs(otherAccount.address, true);
      });
    });
  });

  describe("remove()", () => {
    it("removes an address from the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.remove(otherAccount.address);
      await poolManagerPermission.remove(otherAccount.address);

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("succeeds if the address is not in the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.remove(otherAccount.address);

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon removing an address", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerPermission.remove(otherAccount.address);

        await expect(poolManagerPermission.remove(otherAccount.address))
          .to.emit(poolManagerPermission, "AllowListUpdated")
          .withArgs(otherAccount.address, false);
      });
    });
  });

  describe("setVerificationRegistry()", () => {
    it("adds a registry to the registry list", async () => {
      const {
        poolManagerPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await mockVeriteVerificationRegistry.setVerified(
        otherAccount.address,
        true
      );

      await poolManagerPermission.setVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(true);
    });

    describe("events", () => {
      it("emits an VerificationRegistrySet event upon success", async () => {
        const { poolManagerPermission, mockVeriteVerificationRegistry } =
          await loadFixture(deployFixture);

        await expect(
          poolManagerPermission.setVerificationRegistry(
            mockVeriteVerificationRegistry.address
          )
        )
          .to.emit(poolManagerPermission, "VerificationRegistrySet")
          .withArgs(mockVeriteVerificationRegistry.address);
      });
    });
  });

  describe("removeVerificationRegistry()", () => {
    it("removes the registry", async () => {
      const {
        poolManagerPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await mockVeriteVerificationRegistry.setVerified(
        otherAccount.address,
        true
      );

      await poolManagerPermission.setVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      await poolManagerPermission.removeVerificationRegistry();

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    it("silently succeeds when removing an address that is not present", async () => {
      const {
        poolManagerPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await poolManagerPermission.setVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      // Deploy a new registry
      const MockVeriteVerificationRegistry = await ethers.getContractFactory(
        "MockVeriteVerificationRegistry"
      );
      const otherRegistry = await MockVeriteVerificationRegistry.deploy();
      await otherRegistry.deployed();

      await poolManagerPermission.removeVerificationRegistry();

      expect(
        await poolManagerPermission.isAllowed(otherAccount.address)
      ).to.equal(false);
    });

    describe("events", () => {
      it("emits an VerificationRegistryRemoved event upon success", async () => {
        const { poolManagerPermission } = await loadFixture(deployFixture);

        await expect(
          poolManagerPermission.removeVerificationRegistry()
        ).to.emit(poolManagerPermission, "VerificationRegistryRemoved");
      });
    });
  });
});
