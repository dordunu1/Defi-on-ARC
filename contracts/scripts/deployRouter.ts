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
  
  console.log("Deploying Router with account:", deployer.address);
  
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

  // Read existing deployment info to get factory address
  const deploymentPath = path.join(__dirname, "..", "DEPLOYMENT_ADDRESSES.txt");
  let deploymentInfo: any = {};
  
  if (fs.existsSync(deploymentPath)) {
    const existingData = fs.readFileSync(deploymentPath, "utf-8");
    deploymentInfo = JSON.parse(existingData);
  }

  // Get factory address from deployment info or environment
  const factoryAddress = deploymentInfo.factory?.address || process.env.FACTORY_ADDRESS;
  
  if (!factoryAddress) {
    console.error("ERROR: Factory address not found!");
    console.error("Please provide FACTORY_ADDRESS in .env or ensure DEPLOYMENT_ADDRESSES.txt contains factory address");
    process.exit(1);
  }

  console.log("Using Factory address:", factoryAddress);
  console.log("\n=== Deploying Router ===");
  
  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(factoryAddress);
  console.log("⏳ Waiting for deployment confirmation...");
  
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  
  const routerTx = router.deploymentTransaction();
  if (routerTx) {
    const receipt = await routerTx.wait();
    if (receipt) {
      console.log("✓ Router deployed to:", routerAddress);
      console.log("   Block:", receipt.blockNumber);
      console.log("   Transaction:", routerTx.hash);
      console.log("   Explorer: https://testnet.arcscan.app/address/" + routerAddress);
    } else {
      console.log("✓ Router deployed to:", routerAddress);
    }
  } else {
    console.log("✓ Router deployed to:", routerAddress);
  }
  
  // Update deployment info
  deploymentInfo.router = {
    address: routerAddress,
    factory: factoryAddress,
    deployedAt: new Date().toISOString(),
  };
  
  // Save updated deployment info
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Deployment info saved to:", deploymentPath);

  // Summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Router:", routerAddress);
  console.log("Factory:", factoryAddress);
  
  console.log("\n=== NEXT STEPS ===");
  console.log("1. Update ROUTER_ADDRESS in src/config/dex.ts");
  console.log("2. The Router will work with all existing pools automatically");
  console.log("3. Users can now perform multi-hop swaps (e.g., SRAC → USDC → RACS)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

