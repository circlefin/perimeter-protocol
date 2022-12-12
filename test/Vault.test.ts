import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockERC20 } from "./support/erc20";
import { deployVaultFactory } from "./support/pool";
import { findEventByName } from "./support/utils";
import { deployServiceConfiguration } from "./support/serviceconfiguration";
import { getCommonSigners } from "./support/utils";

describe("Vault", () => {
  async function deployFixture() {
    const {
      pauser,
      deployer,
      otherAccount: vaultOwner,
      otherAccounts
    } = await getCommonSigners();
    const receiver = otherAccounts[0];

    const { serviceConfiguration } = await deployServiceConfiguration();
    const vaultFactory = await deployVaultFactory(serviceConfiguration.address);

    // create a vault
    const txn = await vaultFactory.createVault(vaultOwner.address);
    const receipt = await txn.wait();
    const vaultAddress = findEventByName(receipt, "VaultCreated")?.args?.[0];
    const Vault = await ethers.getContractFactory("Vault");
    const vault = Vault.attach(vaultAddress);

    // Create ERC20 asset
    const { mockERC20 } = await deployMockERC20();
    await mockERC20.mint(vaultOwner.address, 1000);

    // Create ERC721 asset
    const NftAsset = await ethers.getContractFactory("MockERC721");
    const nftAsset = await NftAsset.deploy(
      "Perimeter NFT",
      "PERI",
      "http://example.com/"
    );
    await nftAsset.deployed();

    await nftAsset.mint(vaultOwner.address);
    const tokenId = await nftAsset.tokenOfOwnerByIndex(vaultOwner.address, 0);

    return {
      serviceConfiguration,
      pauser,
      deployer,
      mockERC20,
      vault,
      vaultOwner,
      receiver,
      nftAsset,
      tokenId,
      vaultFactory
    };
  }

  describe("withdrawERC20", () => {
    it("reverts when non-owner withdraws", async () => {
      const { mockERC20, vault, vaultOwner, receiver } = await loadFixture(
        deployFixture
      );

      // transfer in
      await mockERC20.connect(vaultOwner).transfer(vault.address, 1000);

      // transfers out should reverts
      await expect(
        vault
          .connect(receiver)
          .withdrawERC20(mockERC20.address, 500, receiver.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts withdrawing when protocol is paused", async () => {
      const {
        mockERC20,
        serviceConfiguration,
        pauser,
        vault,
        vaultOwner,
        receiver
      } = await loadFixture(deployFixture);

      // transfer in
      await mockERC20.connect(vaultOwner).transfer(vault.address, 1000);

      // pause protocol
      await serviceConfiguration.connect(pauser).setPaused(true);

      // transfers out should reverts
      await expect(
        vault
          .connect(vaultOwner)
          .withdrawERC20(mockERC20.address, 500, receiver.address)
      ).to.be.revertedWith("Vault: Protocol paused");
    });

    it("withdraws to a receiver", async () => {
      const { mockERC20, vault, vaultOwner, receiver } = await loadFixture(
        deployFixture
      );

      // transfer in
      await mockERC20.connect(vaultOwner).transfer(vault.address, 1000);

      // check can transfer out
      const txn = await vault
        .connect(vaultOwner)
        .withdrawERC20(mockERC20.address, 500, receiver.address);
      await txn.wait();

      await expect(txn).to.changeTokenBalances(
        mockERC20,
        [receiver.address, vault.address],
        [+500, -500]
      );

      await expect(txn)
        .to.emit(vault, "WithdrewERC20")
        .withArgs(mockERC20.address, 500, receiver.address);
    });
  });

  describe("withdrawERC721", () => {
    it("reverts when non-owner withdraws", async () => {
      const { vault, vaultOwner, receiver, nftAsset, tokenId } =
        await loadFixture(deployFixture);

      // transfer in
      await nftAsset
        .connect(vaultOwner)
        .transferFrom(vaultOwner.address, vault.address, tokenId);
      expect(await nftAsset.ownerOf(tokenId)).to.equal(vault.address);

      // transfers out should reverts
      await expect(
        vault
          .connect(receiver)
          .withdrawERC721(nftAsset.address, tokenId, receiver.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when protocol is paused", async () => {
      const {
        serviceConfiguration,
        pauser,
        vault,
        vaultOwner,
        receiver,
        nftAsset,
        tokenId
      } = await loadFixture(deployFixture);

      // transfer in
      await nftAsset
        .connect(vaultOwner)
        .transferFrom(vaultOwner.address, vault.address, tokenId);
      expect(await nftAsset.ownerOf(tokenId)).to.equal(vault.address);

      // pause
      await serviceConfiguration.connect(pauser).setPaused(true);

      // transfers out should reverts
      await expect(
        vault
          .connect(vaultOwner)
          .withdrawERC721(nftAsset.address, tokenId, receiver.address)
      ).to.be.revertedWith("Vault: Protocol paused");
    });

    it("withdraws to a receiver", async () => {
      const { vault, vaultOwner, receiver, nftAsset, tokenId } =
        await loadFixture(deployFixture);

      // transfer in
      await nftAsset
        .connect(vaultOwner)
        .transferFrom(vaultOwner.address, vault.address, tokenId);
      expect(await nftAsset.ownerOf(tokenId)).to.equal(vault.address);

      // check can transfer out
      const txn = await vault
        .connect(vaultOwner)
        .withdrawERC721(nftAsset.address, tokenId, receiver.address);
      await txn.wait();

      await expect(txn)
        .to.emit(vault, "WithdrewERC721")
        .withArgs(nftAsset.address, tokenId, receiver.address);
      expect(await nftAsset.ownerOf(tokenId)).to.equal(receiver.address);
    });
  });

  describe("Upgrades", () => {
    it("Can be upgraded", async () => {
      const { deployer, vaultFactory, vaultOwner } = await loadFixture(
        deployFixture
      );

      // new implementation
      const V2Impl = await ethers.getContractFactory("VaultMockV2");
      const v2Impl = await V2Impl.deploy();
      await vaultFactory.connect(deployer).setImplementation(v2Impl.address);

      // create a new vault
      const txn = await vaultFactory.createVault(vaultOwner.address);
      const receipt = await txn.wait();
      const vaultAddress = findEventByName(receipt, "VaultCreated")?.args?.[0];
      const newVault = V2Impl.attach(vaultAddress);

      // Check if its a v2 contract
      expect(await newVault.foo()).to.be.true;
    });
  });
});
