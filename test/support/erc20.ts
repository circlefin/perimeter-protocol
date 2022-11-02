import { ethers } from "hardhat";
import { MockERC20 } from "../../typechain-types";

/**
 * Deploy a Mock ERC20 token
 */
export async function deployMockERC20(
  name = "Test Coin",
  symbol = "TC",
  decimals = 18
) {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockERC20 = await MockERC20.deploy(name, symbol, decimals);
  await mockERC20.deployed();

  return {
    mockERC20
  };
}
