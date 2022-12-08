import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployServiceConfiguration } from "../support/serviceconfiguration";
import { getCommonSigners } from "../support/utils";

describe("BeaconProxyFactory", () => {
  async function deployFixture() {
    const { serviceConfiguration } = await deployServiceConfiguration();
    const { deployer, otherAccounts } = await getCommonSigners();
    const otherAccount = otherAccounts[0];

    const MockBeaconProxyFactory = await ethers.getContractFactory(
      "MockBeaconProxyFactory"
    );
    const mockBeaconProxyFactory = await MockBeaconProxyFactory.deploy(
      serviceConfiguration.address
    );
    await mockBeaconProxyFactory.deployed();

    const MockBeaconImplementation = await ethers.getContractFactory(
      "MockBeaconImplementation"
    );
    const mockBeaconImplementation = await MockBeaconImplementation.deploy();
    await mockBeaconImplementation.deployed();

    return {
      mockBeaconProxyFactory,
      mockBeaconImplementation,
      deployer,
      otherAccount
    };
  }

  describe("Initialization", () => {
    it("initializes the implementation to the zero address", async () => {
      const { mockBeaconProxyFactory } = await loadFixture(deployFixture);

      expect(await mockBeaconProxyFactory.implementation()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("reverts trying to create a proxy against an empty implementation", async () => {
      const { mockBeaconProxyFactory } = await loadFixture(deployFixture);

      await expect(mockBeaconProxyFactory.create()).to.be.revertedWith(
        "ERC1967: beacon implementation is not a contract"
      );
    });
  });

  describe("setImplementation()", () => {
    it("sets the implementation", async () => {
      const { mockBeaconProxyFactory, mockBeaconImplementation, deployer } =
        await loadFixture(deployFixture);

      await mockBeaconProxyFactory
        .connect(deployer)
        .setImplementation(mockBeaconImplementation.address);
      expect(await mockBeaconProxyFactory.implementation()).to.equal(
        mockBeaconImplementation.address
      );
    });

    it("emits an event", async () => {
      const { mockBeaconProxyFactory, mockBeaconImplementation, deployer } =
        await loadFixture(deployFixture);

      await expect(
        mockBeaconProxyFactory
          .connect(deployer)
          .setImplementation(mockBeaconImplementation.address)
      ).to.emit(mockBeaconProxyFactory, "ImplementationSet");
    });

    it("can upgrade to new implementation", async () => {
      const { mockBeaconProxyFactory, mockBeaconImplementation, deployer } =
        await loadFixture(deployFixture);

      // v1
      await expect(
        mockBeaconProxyFactory
          .connect(deployer)
          .setImplementation(mockBeaconImplementation.address)
      ).to.emit(mockBeaconProxyFactory, "ImplementationSet");
      const proxy = await createProxy(mockBeaconProxyFactory);
      const mockV1 = await ethers.getContractAt(
        "MockBeaconImplementation",
        proxy
      );
      expect(await mockV1.foo()).to.equal("bar"); // v1

      // v2
      const V2 = await ethers.getContractFactory("MockBeaconImplementationV2");
      const v2 = await V2.deploy();

      await mockBeaconProxyFactory
        .connect(deployer)
        .setImplementation(v2.address);

      const mockV2 = await ethers.getContractAt(
        "MockBeaconImplementationV2",
        mockV1.address
      );
      expect(await mockV2.foo()).to.equal("baz"); // v2
    });
  });

  describe("create()", () => {
    it("creates a proxy tied to the implementation", async () => {
      const { mockBeaconProxyFactory, mockBeaconImplementation, deployer } =
        await loadFixture(deployFixture);

      await mockBeaconProxyFactory
        .connect(deployer)
        .setImplementation(mockBeaconImplementation.address);
      const proxy = await createProxy(mockBeaconProxyFactory);
      const mock = await ethers.getContractAt(
        "MockBeaconImplementation",
        proxy
      );
      expect(await mock.foo()).to.equal("bar");
    });
  });

  describe("Permissions", () => {
    it("deployer can set an implementation", async () => {
      const { mockBeaconProxyFactory, deployer, mockBeaconImplementation } =
        await loadFixture(deployFixture);

      await expect(
        mockBeaconProxyFactory
          .connect(deployer)
          .setImplementation(mockBeaconImplementation.address)
      ).to.emit(mockBeaconProxyFactory, "ImplementationSet");
    });

    it("reverts if someone else tries to set the implementation", async () => {
      const { mockBeaconProxyFactory, otherAccount, mockBeaconImplementation } =
        await loadFixture(deployFixture);

      await expect(
        mockBeaconProxyFactory
          .connect(otherAccount)
          .setImplementation(mockBeaconImplementation.address)
      ).to.be.revertedWith("Upgrade: unauthorized");
    });
  });

  async function createProxy(factory: any) {
    const txn = await factory.create();
    const rcp = await txn.wait();
    const createdEvent = rcp.events?.find((e: any) => e.event == "Created");
    return createdEvent?.args?.[0];
  }
});
