import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const ownerAddress = "0x34B5e3B8465e0A4b40b4D0819C1eB6c38E160b33"; // Owner wallet address

async function main() {
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    console.error("ERROR: No signers found!");
    process.exit(1);
  }
  
  const deployer = signers[0];
  
  console.log("Transferring StakingRewards Ownership");
  console.log("Deployer account:", deployer.address);
  console.log("Target owner:", ownerAddress);
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

  const STAKING_REWARDS_ADDRESS = deploymentInfo.staking?.stakingRewards?.address || 
                                   deploymentInfo.stakingRewards?.address || 
                                   process.env.STAKING_REWARDS_ADDRESS;

  if (!STAKING_REWARDS_ADDRESS) {
    console.error("ERROR: StakingRewards address not found.");
    process.exit(1);
  }

  console.log("StakingRewards Address:", STAKING_REWARDS_ADDRESS);
  console.log("\n");

  // Get contract instance
  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const stakingRewards = StakingRewards.attach(STAKING_REWARDS_ADDRESS);

  // Check current owner
  const currentOwner = await stakingRewards.owner();
  console.log("Current owner:", currentOwner);
  
  if (currentOwner.toLowerCase() === ownerAddress.toLowerCase()) {
    console.log("✓ Ownership already transferred to target address");
    return;
  }

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`ERROR: Current owner (${currentOwner}) is not the deployer (${deployer.address})`);
    console.error("Cannot transfer ownership. Please use the current owner account.");
    process.exit(1);
  }

  // Transfer ownership
  console.log("\n=== Transferring Ownership ===");
  console.log(`Transferring StakingRewards ownership to: ${ownerAddress}`);
  
  const transferOwnershipTx = await stakingRewards.transferOwnership(ownerAddress);
  console.log(`Transaction: ${transferOwnershipTx.hash}`);
  
  await transferOwnershipTx.wait();
  console.log("✓ StakingRewards ownership transferred");
  
  // Verify ownership
  const newOwner = await stakingRewards.owner();
  console.log(`New owner: ${newOwner}`);
  
  if (newOwner.toLowerCase() === ownerAddress.toLowerCase()) {
    console.log("✓ Ownership transfer verified");
  } else {
    console.warn("⚠ Warning: Ownership verification failed");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
