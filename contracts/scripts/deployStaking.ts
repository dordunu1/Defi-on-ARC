import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

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
  
  console.log("Deploying Staking Contracts with account:", deployer.address);
  
  try {
    const balance = await ethers.provider.getBalance(deployer.address);
    const balanceUSDC = Number(balance) / 1000000;
    console.log("Account balance:", balanceUSDC.toFixed(6), "USDC");
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);
  } catch (error) {
    console.warn("Could not fetch balance or network info:", error);
  }
  console.log("\n");

  const deploymentInfo: any = {
    network: "arc-testnet",
    chainId: 5042002,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  // Step 1: Deploy DOA Token (if not already deployed)
  console.log("=== Deploying DOA Token ===");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  console.log("\nDeploying DOA token...");
  const doaToken = await MockERC20.deploy(
    "Defi on Arc",
    "DOA",
    18
  );
  await doaToken.waitForDeployment();
  const doaTokenAddress = await doaToken.getAddress();
  console.log("✓ DOA token deployed to:", doaTokenAddress);
  
  const doaSupply = await doaToken.totalSupply();
  console.log(`DOA Supply: ${ethers.formatEther(doaSupply)} (10,000,000)`);
  
  deploymentInfo.doaToken = {
    name: "Defi on Arc",
    symbol: "DOA",
    address: doaTokenAddress,
    decimals: 18,
    totalSupply: "10000000",
  };

  // Step 2: Deploy StakingRewards Contract
  console.log("\n=== Deploying StakingRewards Contract ===");
  
  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const stakingRewards = await StakingRewards.deploy(doaTokenAddress);
  console.log("⏳ Waiting for deployment confirmation...");
  
  await stakingRewards.waitForDeployment();
  const stakingAddress = await stakingRewards.getAddress();
  
  const stakingTx = stakingRewards.deploymentTransaction();
  if (stakingTx) {
    const receipt = await stakingTx.wait();
    if (receipt) {
      console.log("✓ StakingRewards deployed to:", stakingAddress);
      console.log("   Block:", receipt.blockNumber);
      console.log("   Transaction:", stakingTx.hash);
      console.log("   Explorer: https://testnet.arcscan.app/address/" + stakingAddress);
    } else {
      console.log("✓ StakingRewards deployed to:", stakingAddress);
    }
  } else {
    console.log("✓ StakingRewards deployed to:", stakingAddress);
  }
  
  deploymentInfo.stakingRewards = {
    address: stakingAddress,
    rewardToken: doaTokenAddress,
  };

  // Step 3: Transfer DOA tokens
  const rewardAmount = ethers.parseEther("1000000"); // 1M DOA tokens for rewards
  const ownerAddress = "0x34B5e3B8465e0A4b40b4D0819C1eB6c38E160b33"; // Owner wallet address
  
  console.log("\n=== Transferring DOA Tokens ===");
  
  // Transfer 1M DOA to StakingRewards contract for rewards
  console.log(`Transferring ${ethers.formatEther(rewardAmount)} DOA tokens to StakingRewards...`);
  const transferToStakingTx = await doaToken.transfer(stakingAddress, rewardAmount);
  await transferToStakingTx.wait();
  console.log("✓ 1M DOA tokens transferred to StakingRewards contract");
  
  // Transfer remaining 9M DOA to owner address
  const remainingAmount = ethers.parseEther("9000000"); // 9M DOA tokens
  console.log(`Transferring ${ethers.formatEther(remainingAmount)} DOA tokens to owner address...`);
  const transferToOwnerTx = await doaToken.transfer(ownerAddress, remainingAmount);
  await transferToOwnerTx.wait();
  console.log(`✓ 9M DOA tokens transferred to owner: ${ownerAddress}`);
  
  const stakingBalance = await doaToken.balanceOf(stakingAddress);
  const ownerBalance = await doaToken.balanceOf(ownerAddress);
  console.log(`StakingRewards balance: ${ethers.formatEther(stakingBalance)} DOA tokens`);
  console.log(`Owner balance: ${ethers.formatEther(ownerBalance)} DOA tokens`);
  
  // NOTE: Ownership transfer will be done AFTER pools are added
  // Run: npm run transfer-staking-ownership (after adding pools)

  // Save deployment info
  const outputPath = path.join(__dirname, "..", "DEPLOYMENT_ADDRESSES.txt");
  let existingInfo: any = {};
  
  // Read existing deployment info if it exists
  if (fs.existsSync(outputPath)) {
    try {
      const existingContent = fs.readFileSync(outputPath, "utf-8");
      existingInfo = JSON.parse(existingContent);
    } catch (error) {
      console.warn("Could not read existing deployment info, creating new file");
    }
  }
  
  // Merge with existing info
  const mergedInfo = {
    ...existingInfo,
    ...deploymentInfo,
    staking: deploymentInfo, // Also save under 'staking' key for easy access
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(mergedInfo, null, 2));
  console.log("\n✅ Deployment info saved to:", outputPath);

  // Summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("\nDOA Token:");
  console.log("  Address:", deploymentInfo.doaToken.address);
  console.log("  Symbol: DOA");
  console.log("  Decimals: 18");
  console.log("\nStakingRewards:");
  console.log("  Address:", deploymentInfo.stakingRewards.address);
  console.log("  Reward Token:", deploymentInfo.stakingRewards.rewardToken);
  console.log("  Initial Rewards:", ethers.formatEther(rewardAmount), "DOA");
  
  console.log("\n=== NEXT STEPS ===");
  console.log("1. Update DEX_CONFIG in src/config/dex.ts:");
  console.log(`   DOA_TOKEN_ADDRESS: "${doaTokenAddress}"`);
  console.log(`   STAKING_REWARDS_ADDRESS: "${stakingAddress}"`);
  console.log("\n2. Add pools to staking contract:");
  console.log("   - Call addPool() for each pool you want to enable farming");
  console.log("   - Set appropriate reward rates (DOA tokens per second)");
  console.log("\n3. Example: Add USDC/SRAC pool with 0.05 DOA/sec reward rate:");
  console.log(`   await stakingRewards.addPool(poolAddress, poolAddress, ethers.parseEther("0.05"))`);
  console.log("\n4. Update frontend to include DOA token in TOKENS map");
  console.log("5. Deploy UI components for farming/staking");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
