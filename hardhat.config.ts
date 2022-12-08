import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "./tasks/serviceConfiguration";
import "./tasks/tosAcceptanceRegistry";
import "solidity-docgen";

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
      url: "",
      usdcAddress: "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
    }
  },
  docgen: {
    pages: "files"
  }
};

export default config;
