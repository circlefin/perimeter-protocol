import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10
      }
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    }
  }
};

export default config;
