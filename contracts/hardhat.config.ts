import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
      // Default EVM version for Solidity 0.8.20 is "paris"
    }
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.blockdaemon.testnet.arc.io",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto", // Let Hardhat automatically determine gas price
      gas: "auto", // Let Hardhat automatically determine gas limit
      timeout: 120000, // 2 minutes timeout (matches working config)
    },
    hardhat: {
      chainId: 1337,
      // For local testing
    }
  },
  etherscan: {
    apiKey: {
      arcTestnet: "your-api-key" // Arc explorer API if available
    },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;

