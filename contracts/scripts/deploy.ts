import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Get deployment type from environment variable or default to "all"
// Usage: DEPLOY_TYPE=tokens npm run deploy:arc or DEPLOY_TYPE=factory npm run deploy:arc
const deploymentType = process.env.DEPLOY_TYPE || "all"; // "tokens", "factory", or "all"

async function main() {
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("ERROR: No signers found!");
    console.error("Make sure you have:");
    console.error("1. Created a .env file in the contracts folder");
    console.error("2. Added your PRIVATE_KEY=0x... to the .env file");
    console.error("3. The private key is valid and starts with 0x");
    process.exit(1);
  }
  
  const deployer = signers[0];
  
  console.log("Deploying contracts with account:", deployer.address);
  
  try {
    const balance = await ethers.provider.getBalance(deployer.address);
    // Arc uses USDC (6 decimals), so format accordingly
    const balanceUSDC = Number(balance) / 1000000;
    console.log("Account balance:", balanceUSDC.toFixed(6), "USDC");
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);
    
    // Check for pending transactions (might cause "underpriced" error)
    const pendingCount = await ethers.provider.getTransactionCount(deployer.address, "pending");
    const latestCount = await ethers.provider.getTransactionCount(deployer.address, "latest");
    
    if (pendingCount > latestCount) {
      console.warn(`⚠️  Warning: ${pendingCount - latestCount} pending transaction(s) detected.`);
      console.warn("   This might cause 'replacement transaction underpriced' errors.");
      console.warn("   You may need to wait for pending transactions to confirm or increase gas price.");
    }
  } catch (error) {
    console.warn("Could not fetch balance or network info:", error);
  }
  console.log("\n");

  const deploymentInfo: any = {
    network: "arc-testnet",
    chainId: 5042002,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    tokens: {},
  };

  // Deploy tokens if requested
  if (deploymentType === "tokens" || deploymentType === "all") {
    console.log("=== Deploying Tokens (KITTY, DOGG) ===");
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    // Deploy KITTY token
    console.log("\nDeploying KITTY token...");
    const kitty = await MockERC20.deploy(
      "Kitty Token",
      "KITTY",
      18
    );
    await kitty.waitForDeployment();
    const kittyAddress = await kitty.getAddress();
    console.log("✓ KITTY deployed to:", kittyAddress);
    deploymentInfo.tokens.KITTY = {
      name: "Kitty Token",
      symbol: "KITTY",
      address: kittyAddress,
      decimals: 18,
      totalSupply: "10000000",
    };

    // Deploy DOGG token
    console.log("\nDeploying DOGG token...");
    const dogg = await MockERC20.deploy(
      "Dogg Token",
      "DOGG",
      18
    );
    await dogg.waitForDeployment();
    const doggAddress = await dogg.getAddress();
    console.log("✓ DOGG deployed to:", doggAddress);
    deploymentInfo.tokens.DOGG = {
      name: "Dogg Token",
      symbol: "DOGG",
      address: doggAddress,
      decimals: 18,
      totalSupply: "10000000",
    };

    // Verify supply
    const kittySupply = await kitty.totalSupply();
    const doggSupply = await dogg.totalSupply();
    
    console.log("\n=== Token Supply Verification ===");
    console.log(`KITTY Supply: ${ethers.formatEther(kittySupply)} (10,000,000)`);
    console.log(`DOGG Supply: ${ethers.formatEther(doggSupply)} (10,000,000)`);
    console.log("\n");
  }

  // Deploy PoolFactory if requested
  if (deploymentType === "factory" || deploymentType === "all") {
    console.log("=== Deploying PoolFactory ===");
    
    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    const factory = await PoolFactory.deploy();
    console.log("⏳ Waiting for deployment confirmation...");
    
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    
    const factoryTx = factory.deploymentTransaction();
    if (factoryTx) {
      const receipt = await factoryTx.wait();
      if (receipt) {
        console.log("✓ PoolFactory deployed to:", factoryAddress);
        console.log("   Block:", receipt.blockNumber);
        console.log("   Transaction:", factoryTx.hash);
        console.log("   Explorer: https://testnet.arcscan.app/address/" + factoryAddress);
      } else {
        console.log("✓ PoolFactory deployed to:", factoryAddress);
      }
    } else {
      console.log("✓ PoolFactory deployed to:", factoryAddress);
    }
    
    deploymentInfo.factory = {
      address: factoryAddress,
    };
    console.log("\n");
  }

  // Save deployment info
  const outputPath = path.join(__dirname, "..", "DEPLOYMENT_ADDRESSES.txt");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", outputPath);

  // Summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  if (deploymentInfo.tokens.KITTY) {
    console.log("\nTokens:");
    console.log("  KITTY:", deploymentInfo.tokens.KITTY.address);
    console.log("  DOGG:", deploymentInfo.tokens.DOGG.address);
  }
  if (deploymentInfo.factory) {
    console.log("\nFactory:", deploymentInfo.factory.address);
  }
  
  console.log("\n=== NEXT STEPS ===");
  if (deploymentInfo.tokens.KITTY) {
    console.log("1. Update TOKENS record in src/hooks/useDEX.ts with token addresses above");
    console.log("2. Add KITTY and DOGG to TokenSymbol type in src/hooks/useDEX.ts");
    console.log("3. Add logo mappings in src/utils/tokenLogos.ts (cat.png for KITTY, dog.png for DOGG)");
  }
  if (deploymentInfo.factory) {
    console.log(`${deploymentInfo.tokens.KITTY ? "2" : "1"}. Update FACTORY_ADDRESS in src/config/dex.ts`);
    console.log(`${deploymentInfo.tokens.KITTY ? "3" : "2"}. Create pools via the UI using the 'Create Pool' tab`);
    console.log(`${deploymentInfo.tokens.KITTY ? "4" : "3"}. Add liquidity through the 'Liquidity' tab`);
    console.log(`${deploymentInfo.tokens.KITTY ? "5" : "4"}. Start trading!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
