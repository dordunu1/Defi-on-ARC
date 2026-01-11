import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// USDC address on Arc Testnet
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Reward rate: 0.05 DOA tokens per second
const REWARD_RATE = ethers.parseEther("0.05"); // 0.05 DOA per second

async function main() {
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("ERROR: No signers found!");
    process.exit(1);
  }
  
  const deployer = signers[0];
  
  console.log("Adding USDC Pairs to Staking with account:", deployer.address);
  
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

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, "..", "DEPLOYMENT_ADDRESSES.txt");
  let deploymentInfo: any = {};
  
  if (fs.existsSync(deploymentPath)) {
    try {
      const content = fs.readFileSync(deploymentPath, "utf-8");
      deploymentInfo = JSON.parse(content);
    } catch (error) {
      console.error("Error reading deployment info:", error);
      process.exit(1);
    }
  } else {
    console.error("DEPLOYMENT_ADDRESSES.txt not found. Please deploy contracts first.");
    process.exit(1);
  }

  // Get addresses from deployment info or environment
  // Factory address is hardcoded in DEX config (same as indexer)
  const FACTORY_ADDRESS = deploymentInfo.factory?.address || 
                          process.env.FACTORY_ADDRESS || 
                          "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C"; // Default factory address
  const STAKING_REWARDS_ADDRESS = deploymentInfo.staking?.stakingRewards?.address || 
                                   deploymentInfo.stakingRewards?.address || 
                                   process.env.STAKING_REWARDS_ADDRESS;

  if (!FACTORY_ADDRESS) {
    console.error("ERROR: Factory address not found. Please deploy PoolFactory first.");
    process.exit(1);
  }

  if (!STAKING_REWARDS_ADDRESS) {
    console.error("ERROR: StakingRewards address not found. Please deploy StakingRewards first.");
    process.exit(1);
  }

  console.log("Factory Address:", FACTORY_ADDRESS);
  console.log("StakingRewards Address:", STAKING_REWARDS_ADDRESS);
  console.log("Reward Rate:", ethers.formatEther(REWARD_RATE), "DOC per second");
  console.log("\n");

  // Get contract instances
  const Factory = await ethers.getContractFactory("PoolFactory");
  const factory = Factory.attach(FACTORY_ADDRESS);

  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const stakingRewards = StakingRewards.attach(STAKING_REWARDS_ADDRESS);

  // Only add these specific pools (main pairs only)
  const allowedPools = [
    "0xd065a783C362d73b5a62EfB2B2e5DEDe49d16aa3", // USDC/SRAC
    "0x18eAE2e870Ec4Bc31a41B12773c4F5c40Bf19aCD", // USDC/EURC
    "0x55b9CbF50dc1171526635d03267f4A0979f1fFBb", // USDC/RACS
    "0xFDC1F922f7065602F06504d62E314A1cEe72c189", // USDC/SACS
    "0xa7Eb57a1538BC8ca2F0452954610A7d6f1F0242B", // USDC/DOGG
    "0xFabB12B18c4b0B79dd97D8EA7c000F7424C76195", // USDC/KITTY
  ];

  console.log("=== Adding Selected Pools to Staking ===");
  console.log(`Will add ${allowedPools.length} specific pools\n`);

  const usdcPools: Array<{ poolAddress: string; tokenA: string; tokenB: string }> = [];

  // Get pool info for each allowed pool
  for (const poolAddress of allowedPools) {
    try {
      // Get pool contract to read tokens
      const Pool = await ethers.getContractFactory("SimplePoolWithLP");
      const pool = Pool.attach(poolAddress);
      
      const [tokenA, tokenB] = await Promise.all([
        pool.tokenA(),
        pool.tokenB(),
      ]);

      // Get token symbols for display
      let tokenASymbol = "Unknown";
      let tokenBSymbol = "Unknown";
      
      try {
        const ERC20 = await ethers.getContractFactory("MockERC20");
        const tokenALower = tokenA.toLowerCase();
        const tokenBLower = tokenB.toLowerCase();
        const usdcLower = USDC_ADDRESS.toLowerCase();
        
        if (tokenALower !== usdcLower) {
          const tokenAContract = ERC20.attach(tokenA);
          tokenASymbol = await tokenAContract.symbol();
        } else {
          tokenASymbol = "USDC";
        }
        
        if (tokenBLower !== usdcLower) {
          const tokenBContract = ERC20.attach(tokenB);
          tokenBSymbol = await tokenBContract.symbol();
        } else {
          tokenBSymbol = "USDC";
        }
      } catch (error) {
        console.warn(`  Could not get symbols for pool ${poolAddress}`);
      }

      usdcPools.push({
        poolAddress,
        tokenA,
        tokenB,
      });

      console.log(`✓ Pool: ${tokenASymbol}/${tokenBSymbol}`);
      console.log(`  Address: ${poolAddress}`);
    } catch (error) {
      console.warn(`  Error checking pool ${poolAddress}:`, error);
    }
  }

  console.log(`\n=== Found ${usdcPools.length} Pools to Add ===\n`);

  if (usdcPools.length === 0) {
    console.log("No pools found. Please check pool addresses.");
    return;
  }

  // Add each USDC pool to staking
  console.log("=== Adding Pools to Staking ===");
  const addedPools: string[] = [];
  const skippedPools: string[] = [];

  for (const pool of usdcPools) {
    try {
      // Check if pool is already added
      const poolInfo = await stakingRewards.getPoolInfo(pool.poolAddress);
      
      if (poolInfo.isActive) {
        console.log(`⏭️  Pool ${pool.poolAddress} already added, skipping...`);
        skippedPools.push(pool.poolAddress);
        continue;
      }

      // Add pool to staking
      // Note: LP token address is the same as pool address for SimplePoolWithLP
      console.log(`\nAdding pool ${pool.poolAddress}...`);
      const tx = await stakingRewards.addPool(
        pool.poolAddress,
        pool.poolAddress, // LP token is the pool itself
        REWARD_RATE
      );
      
      console.log(`  Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt) {
        console.log(`✓ Successfully added pool ${pool.poolAddress}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        addedPools.push(pool.poolAddress);
      }
    } catch (error: any) {
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes("Pool already exists") || errorMsg.includes("Pool not active")) {
        console.log(`⏭️  Pool ${pool.poolAddress} already exists, skipping...`);
        skippedPools.push(pool.poolAddress);
      } else {
        console.error(`✗ Error adding pool ${pool.poolAddress}:`, errorMsg);
      }
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total USDC pairs found: ${usdcPools.length}`);
  console.log(`Successfully added: ${addedPools.length}`);
  console.log(`Skipped (already added): ${skippedPools.length}`);
  
  if (addedPools.length > 0) {
    console.log("\nAdded pools:");
    addedPools.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
  }

  if (skippedPools.length > 0) {
    console.log("\nSkipped pools (already added):");
    skippedPools.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
  }

  console.log("\n=== NEXT STEPS ===");
  console.log("1. Verify pools in staking contract:");
  console.log(`   await stakingRewards.getAllPools()`);
  console.log("\n2. Check pool info:");
  console.log(`   await stakingRewards.getPoolInfo("${addedPools[0] || usdcPools[0].poolAddress}")`);
  console.log("\n3. Start the staking indexer to track staking data in Supabase");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
