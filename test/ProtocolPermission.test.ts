import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ProtocolPermission", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    // Deploy the ProtocolPermission contract
    const ProtocolPermission = await ethers.getContractFactory(
      "ProtocolPermission",
      owner
    );
    const protocolPermission = await ProtocolPermission.deploy();
    await protocolPermission.deployed();

    // Deploy the MockVeriteVerificationRegistry contract
    const MockVeriteVerificationRegistry = await ethers.getContractFactory(
      "MockVeriteVerificationRegistry"
    );
    const mockVeriteVerificationRegistry =
      await MockVeriteVerificationRegistry.deploy();
    await mockVeriteVerificationRegistry.deployed();

    return {
      protocolPermission,
      mockVeriteVerificationRegistry,
      owner,
      otherAccount
    };
  }

  describe("isAllowed()", () => {
    describe("without verification registries", () => {
      it("returns false if the address is not in the allow list", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(false);
      });

      it("returns true if the address is on the allow list", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await protocolPermission.setAllowed(otherAccount.getAddress(), true);

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });
    });

    describe("with verification registries", () => {
      it("returns true if the address is not in the allow list but is in the registry", async () => {
        const {
          protocolPermission,
          mockVeriteVerificationRegistry,
          otherAccount
        } = await loadFixture(deployFixture);

        await protocolPermission.addVerificationRegistry(
          mockVeriteVerificationRegistry.address
        );

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });
    });
  });

  describe("setAllowed()", () => {
    describe("adding", () => {
      it("adds an address to the allowList", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await protocolPermission.setAllowed(otherAccount.getAddress(), true);

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });

      it("succeeds if the address is already in the allowList", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await protocolPermission.setAllowed(otherAccount.getAddress(), true);
        await protocolPermission.setAllowed(otherAccount.getAddress(), true);

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(true);
      });

      describe("events", () => {
        it("emits an AllowListUpdated event upon adding an address", async () => {
          const { protocolPermission, otherAccount } = await loadFixture(
            deployFixture
          );

          expect(
            await protocolPermission.setAllowed(otherAccount.getAddress(), true)
          )
            .to.emit(protocolPermission, "AllowListUpdated")
            .withArgs(otherAccount.getAddress(), true);
        });
      });
    });

    describe("removing", () => {
      it("removes an address from the allowList", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await protocolPermission.setAllowed(otherAccount.getAddress(), false);
        await protocolPermission.setAllowed(otherAccount.getAddress(), false);

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(false);
      });

      it("succeeds if the address is not in the allowList", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await protocolPermission.setAllowed(otherAccount.getAddress(), false);

        expect(
          await protocolPermission.isAllowed(otherAccount.getAddress())
        ).to.equal(false);
      });

      describe("events", () => {
        it("emits an AllowListUpdated event upon removing an address", async () => {
          const { protocolPermission, otherAccount } = await loadFixture(
            deployFixture
          );

          await protocolPermission.setAllowed(otherAccount.getAddress(), false);

          expect(
            await protocolPermission.setAllowed(
              otherAccount.getAddress(),
              false
            )
          )
            .to.emit(protocolPermission, "AllowListUpdated")
            .withArgs(otherAccount.getAddress(), false);
        });
      });
    });

    describe("ownership", () => {
      it("reverts if not called by the Owner", async () => {
        const { protocolPermission, otherAccount } = await loadFixture(
          deployFixture
        );

        await expect(
          protocolPermission
            .connect(otherAccount)
            .setAllowed(otherAccount.getAddress(), true)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });

  describe("addVerificationRegistry()", () => {
    it("adds a registry to the registry list", async () => {
      const {
        protocolPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await protocolPermission.addVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      expect(
        await protocolPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(true);
    });

    describe("events", () => {
      it("emits an VerificationRegistryListUpdated event upon success", async () => {
        const { protocolPermission, mockVeriteVerificationRegistry } =
          await loadFixture(deployFixture);

        expect(
          await protocolPermission.addVerificationRegistry(
            mockVeriteVerificationRegistry.address
          )
        )
          .to.emit(protocolPermission, "VerificationRegistryListUpdated")
          .withArgs(mockVeriteVerificationRegistry, true);
      });
    });
  });

  describe("removeVerificationRegistry()", () => {
    it("removes a registry from the registry list", async () => {
      const {
        protocolPermission,
        mockVeriteVerificationRegistry,
        otherAccount
      } = await loadFixture(deployFixture);

      await protocolPermission.addVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      await protocolPermission.removeVerificationRegistry(
        mockVeriteVerificationRegistry.address
      );

      expect(
        await protocolPermission.isAllowed(otherAccount.getAddress())
      ).to.equal(false);
    });

    describe("events", () => {
      it("emits an VerificationRegistryListUpdated event upon success", async () => {
        const { protocolPermission, mockVeriteVerificationRegistry } =
          await loadFixture(deployFixture);

        expect(
          await protocolPermission.removeVerificationRegistry(
            mockVeriteVerificationRegistry.address
          )
        )
          .to.emit(protocolPermission, "VerificationRegistryListUpdated")
          .withArgs(mockVeriteVerificationRegistry, false);
      });
    });
  });
});
