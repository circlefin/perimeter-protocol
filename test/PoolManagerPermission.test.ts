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
    describe("without verification registries", () => {
      it("returns false if the address is not in the allow list", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(false);
      });

      it("returns true if the address is on the allow list", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerPermission.allow(otherAccount.getAddress());

        expect(
          await poolManagerPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });
    });

    describe("with verification registries", () => {
      it("returns true if the address is on an allowList, even if not present in a VerificationRegistry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await poolManagerPermission.allow(otherAccount.getAddress());
        await poolManagerPermission.addVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });

      it("returns true if the address is not in the allowList but is in the registry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        mockVeriteVerificationRegistry.setVerified(
          otherAccount.getAddress(),
          true
        );

        await poolManagerPermission.addVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });

      it("returns true if the address is is in any supported registry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        // Deploy a new registry
        const MockVeriteVerificationRegistry = await ethers.getContractFactory(
          "MockVeriteVerificationRegistry"
        );
        const emptyRegistry = await MockVeriteVerificationRegistry.deploy();
        await emptyRegistry.deployed();

        // Add the empty registry to the list first
        await poolManagerPermission.addVerificationRegistry(
          emptyRegistry.address
        );

        mockVeriteVerificationRegistry.setVerified(
          otherAccount.getAddress(),
          true
        );

        await poolManagerPermission.addVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });

      it("returns false if the address is not in the allowList and not in the registry", async () => {
        const {
          poolManagerPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await poolManagerPermission.addVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await poolManagerPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(false);
      });
    });
  });

  describe("allow()", () => {
    it("adds an address to the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.allow(otherAccount.getAddress());

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(true);
    });

    it("succeeds if the address is already in the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.allow(otherAccount.getAddress());
      await poolManagerPermission.allow(otherAccount.getAddress());

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(true);
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon adding an address", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(await poolManagerPermission.allow(otherAccount.getAddress()))
          .to.emit(poolManagerPermission, "AllowListUpdated")
          .withArgs(otherAccount.getAddress(), true);
      });
    });
  });

  describe("remove()", () => {
    it("removes an address from the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.remove(otherAccount.getAddress());
      await poolManagerPermission.remove(otherAccount.getAddress());

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    it("succeeds if the address is not in the allowList", async () => {
      const { poolManagerPermission, otherAccount } = await loadFixture(
        deployFixture
      );

      await poolManagerPermission.remove(otherAccount.getAddress());

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    describe("events", () => {
      it("emits an AllowListUpdated event upon removing an address", async () => {
        const { poolManagerPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await poolManagerPermission.remove(otherAccount.getAddress());

        expect(await poolManagerPermission.remove(otherAccount.getAddress()))
          .to.emit(poolManagerPermission, "AllowListUpdated")
          .withArgs(otherAccount.getAddress(), false);
      });
    });
  });

  describe("addVerificationRegistry()", () => {
    it("adds a registry to the registry list", async () => {
      const {
        poolManagerPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      mockVeriteVerificationRegistry.setVerified(
        otherAccount.getAddress(),
        true
      );

      await poolManagerPermission.addVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(true);
    });

    describe("events", () => {
      it("emits an VerificationRegistryListUpdated event upon success", async () => {
        const { poolManagerPermission, mockVeriteVerificationRegistry } =
          await loadFixture(deployFixture);

        expect(
          await poolManagerPermission.addVerificationRegistry(
            mockVeriteVerificationRegistry.address
          )
        )
          .to.emit(poolManagerPermission, "VerificationRegistryListUpdated")
          .withArgs(mockVeriteVerificationRegistry, true);
      });
    });
  });

  describe("removeVerificationRegistry()", () => {
    it("removes a registry from the registry list", async () => {
      const {
        poolManagerPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      mockVeriteVerificationRegistry.setVerified(
        otherAccount.getAddress(),
        true
      );

      await poolManagerPermission.addVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      await poolManagerPermission.removeVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    it("silently succeeds when removing an address that is not present", async () => {
      const {
        poolManagerPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await poolManagerPermission.addVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      // Deploy a new registry
      const MockVeriteVerificationRegistry = await ethers.getContractFactory(
        "MockVeriteVerificationRegistry"
      );
      const otherRegistry = await MockVeriteVerificationRegistry.deploy();
      await otherRegistry.deployed();

      await poolManagerPermission.removeVerificationRegistry(
        otherRegistry.address
      );

      expect(
        await poolManagerPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    describe("events", () => {
      it("emits an VerificationRegistryListUpdated event upon success", async () => {
        const { poolManagerPermission, mockVeriteVerificationRegistry } =
          await loadFixture(deployFixture);

        expect(
          await poolManagerPermission.removeVerificationRegistry(
            mockVeriteVerificationRegistry.address
          )
        )
          .to.emit(poolManagerPermission, "VerificationRegistryListUpdated")
          .withArgs(mockVeriteVerificationRegistry, false);
      });
    });
  });
});
