import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "./tasks/serviceConfiguration";
import "./tasks/tosAcceptanceRegistry";
import "solidity-docgen";
import * as dotenv from "dotenv";
dotenv.config();

type ExtendedHardhatUserConfig = {
  networks: {
    [network: string]: {
      usdcAddress: string | undefined;
    };
  };
};

const config: HardhatUserConfig | ExtendedHardhatUserConfig = {
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
      allowUnlimitedContractSize: true,
      usdcAddress: undefined
    },
    localhost: {
      usdcAddress: undefined
    },
    goerli: {
      chainId: 5,
      url: process.env.GOERLI_URL ?? "",
      usdcAddress: "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
      accounts: [
        process.env.GOERLI_ADMIN!,
        process.env.GOERLI_OPERATOR!,
        process.env.GOERLI_DEPLOYER!,
        process.env.GOERLI_PAUSER!
      ].filter((x) => x)
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};

export default config;
