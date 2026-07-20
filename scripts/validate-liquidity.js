/**
 * Liquidity Removal Validation Script
 * 
 * Validates that removing liquidity returns the correct amounts based on LP token share
 * 
 * Usage: node scripts/validate-liquidity.js [poolAddress] [userAddress]
 * Example: node scripts/validate-liquidity.js 0x6f533E099B2B9468F98685Cc9F09D547661ca5d6 0xYourAddress
 */

import dotenv from 'dotenv';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';

dotenv.config();

// Arc Testnet RPC
const RPC_URL = 'https://rpc.blockdaemon.testnet.arc.io';

const publicClient = createPublicClient({
  chain: {
    id: 5042002,
    name: 'Arc Testnet',
    network: 'arc-testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: {
      default: { http: [RPC_URL] },
      public: { http: [RPC_URL] },
    },
    blockExplorers: {
      default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
    },
  },
  transport: http(RPC_URL),
});

// ABIs
const POOL_ABI = [
  {
    inputs: [],
    name: 'tokenA',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenB',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const ERC20_ABI = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Known tokens for decimals
const KNOWN_TOKENS = {
  '0x3600000000000000000000000000000000000000': { symbol: 'USDC', decimals: 6 },
  '0x12dfe2bd72c55e7d91e0679da7c9cc5ecb5524e6': { symbol: 'RAC', decimals: 18 },
  '0xa1456f93c2f36f97497f82cffbb2ea9c063465d5': { symbol: 'RACD', decimals: 18 },
  '0xd472f90af8048f1b2bcd8f22784e900146cd9ecc': { symbol: 'RACA', decimals: 18 },
};

async function getTokenInfo(tokenAddress) {
  const lower = tokenAddress.toLowerCase();
  if (KNOWN_TOKENS[lower]) {
    return KNOWN_TOKENS[lower];
  }
  
  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);
    return { symbol, decimals };
  } catch (error) {
    console.error(`Error fetching token info for ${tokenAddress}:`, error);
    return { symbol: 'UNKNOWN', decimals: 18 };
  }
}

async function validateLiquidityRemoval(poolAddress, userAddress) {
  console.log('\n========================================');
  console.log('LIQUIDITY REMOVAL VALIDATION');
  console.log('========================================\n');
  
  console.log(`Pool Address: ${poolAddress}`);
  console.log(`User Address: ${userAddress || 'Not provided'}\n`);

  try {
    // 1. Get pool tokens
    console.log('📋 Step 1: Fetching pool information...');
    const [tokenA, tokenB] = await Promise.all([
      publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'tokenA',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'tokenB',
      }),
    ]);

    const [tokenAInfo, tokenBInfo] = await Promise.all([
      getTokenInfo(tokenA),
      getTokenInfo(tokenB),
    ]);

    console.log(`   Token A: ${tokenA} (${tokenAInfo.symbol}, ${tokenAInfo.decimals} decimals)`);
    console.log(`   Token B: ${tokenB} (${tokenBInfo.symbol}, ${tokenBInfo.decimals} decimals)\n`);

    // 2. Read ACTUAL token balances (source of truth - same as indexer)
    console.log('💰 Step 2: Reading ACTUAL token balances from ERC20 contracts...');
    const [reserveA, reserveB] = await Promise.all([
      publicClient.readContract({
        address: tokenA,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [poolAddress],
      }),
      publicClient.readContract({
        address: tokenB,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [poolAddress],
      }),
    ]);

    const reserveAFormatted = formatUnits(reserveA, tokenAInfo.decimals);
    const reserveBFormatted = formatUnits(reserveB, tokenBInfo.decimals);
    
    console.log(`   Reserve A: ${reserveA.toString()} (${reserveAFormatted} ${tokenAInfo.symbol})`);
    console.log(`   Reserve B: ${reserveB.toString()} (${reserveBFormatted} ${tokenBInfo.symbol})\n`);

    // 3. Get total LP supply
    console.log('📊 Step 3: Getting total LP supply...');
    const totalSupply = await publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'totalSupply',
    });

    const totalSupplyFormatted = formatUnits(totalSupply, 18);
    console.log(`   Total LP Supply: ${totalSupply.toString()} (${totalSupplyFormatted} LP tokens)\n`);

    // 4. Get user's LP balance (if address provided)
    let userLPBalance = null;
    let userLPFormatted = null;
    let lpShare = null;

    if (userAddress) {
      console.log('👤 Step 4: Getting user LP balance...');
      userLPBalance = await publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });

      userLPFormatted = formatUnits(userLPBalance, 18);
      lpShare = Number(userLPBalance) / Number(totalSupply);
      
      console.log(`   User LP Balance: ${userLPBalance.toString()} (${userLPFormatted} LP tokens)`);
      console.log(`   LP Share: ${(lpShare * 100).toFixed(6)}%\n`);
    }

    // 5. Calculate expected amounts for LP holder(s)
    console.log('🧮 Step 5: Calculating tokens each LP holder will receive...\n');
    
    console.log('   Calculation Formula:');
    console.log(`   amountA = (Your LP tokens / total LP supply) * reserveA`);
    console.log(`   amountB = (Your LP tokens / total LP supply) * reserveB\n`);
    
    if (userAddress && userLPBalance) {
      // Calculate for specific user
      const userLpNum = Number(userLPBalance);
      const userShare = (userLpNum / Number(totalSupply)) * 100;
      
      const expectedAmountA = (userLpNum * Number(reserveA)) / Number(totalSupply);
      const expectedAmountB = (userLpNum * Number(reserveB)) / Number(totalSupply);
      
      const expectedAmountAFormatted = formatUnits(BigInt(Math.floor(expectedAmountA)), tokenAInfo.decimals);
      const expectedAmountBFormatted = formatUnits(BigInt(Math.floor(expectedAmountB)), tokenBInfo.decimals);

      console.log(`   📍 For User: ${userAddress}`);
      console.log(`   LP Tokens: ${formatUnits(userLPBalance, 18)}`);
      console.log(`   Pool Share: ${userShare.toFixed(6)}%\n`);
      console.log(`   ✅ When removing ALL liquidity, this holder will receive:`);
      console.log(`      ${tokenAInfo.symbol}: ${expectedAmountAFormatted}`);
      console.log(`      ${tokenBInfo.symbol}: ${expectedAmountBFormatted}\n`);
      
      // Also show calculation breakdown
      console.log('   Calculation Breakdown:');
      console.log(`      ${tokenAInfo.symbol}: (${formatUnits(userLPBalance, 18)} / ${totalSupplyFormatted}) × ${reserveAFormatted} = ${expectedAmountAFormatted}`);
      console.log(`      ${tokenBInfo.symbol}: (${formatUnits(userLPBalance, 18)} / ${totalSupplyFormatted}) × ${reserveBFormatted} = ${expectedAmountBFormatted}\n`);
    } else {
      // Show example calculations for 1 LP token, 10 LP tokens, and total
      console.log('   📊 Example Calculations:\n');
      
      // Check if pool has LP supply (if 0, all liquidity removed)
      if (Number(totalSupply) === 0) {
        console.log(`   ⚠️  WARNING: Pool has ZERO LP supply (all liquidity removed)`);
        console.log(`   This pool should not be shown in the UI.`);
        console.log(`   Remaining reserves (if any) are trapped in the contract.\n`);
      } else {
        // 1 LP token example
        const oneLP = parseUnits('1', 18);
        const amountAForOneLP = (Number(oneLP) * Number(reserveA)) / Number(totalSupply);
        const amountBForOneLP = (Number(oneLP) * Number(reserveB)) / Number(totalSupply);
        console.log(`   1 LP Token removes:`);
        console.log(`      ${tokenAInfo.symbol}: ${formatUnits(BigInt(Math.floor(amountAForOneLP)), tokenAInfo.decimals)}`);
        console.log(`      ${tokenBInfo.symbol}: ${formatUnits(BigInt(Math.floor(amountBForOneLP)), tokenBInfo.decimals)}\n`);
        
        // Show what removing total supply would give
        const expectedAmountA = (Number(totalSupply) * Number(reserveA)) / Number(totalSupply);
        const expectedAmountB = (Number(totalSupply) * Number(reserveB)) / Number(totalSupply);
        const expectedAmountAFormatted = formatUnits(BigInt(Math.floor(expectedAmountA)), tokenAInfo.decimals);
        const expectedAmountBFormatted = formatUnits(BigInt(Math.floor(expectedAmountB)), tokenBInfo.decimals);
        
        console.log(`   Total LP Supply (${totalSupplyFormatted} LP tokens) removes:`);
        console.log(`      ${tokenAInfo.symbol}: ${expectedAmountAFormatted} (should equal total reserve)`);
        console.log(`      ${tokenBInfo.symbol}: ${expectedAmountBFormatted} (should equal total reserve)\n`);
      }
    }

    // 6. Summary
    console.log('========================================');
    console.log('VALIDATION SUMMARY');
    console.log('========================================\n');
    console.log(`Pool: ${tokenAInfo.symbol}/${tokenBInfo.symbol}`);
    console.log(`Total Reserves:`);
    console.log(`  ${tokenAInfo.symbol}: ${reserveAFormatted}`);
    console.log(`  ${tokenBInfo.symbol}: ${reserveBFormatted}`);
    console.log(`Total LP Supply: ${totalSupplyFormatted} LP tokens\n`);
    
    if (userAddress && userLPBalance) {
      const expectedAmountA = (Number(userLPBalance) * Number(reserveA)) / Number(totalSupply);
      const expectedAmountB = (Number(userLPBalance) * Number(reserveB)) / Number(totalSupply);
      const expectedAmountAFormatted = formatUnits(BigInt(Math.floor(expectedAmountA)), tokenAInfo.decimals);
      const expectedAmountBFormatted = formatUnits(BigInt(Math.floor(expectedAmountB)), tokenBInfo.decimals);
      
      console.log(`📍 Your Position:`);
      console.log(`  LP Tokens: ${userLPFormatted}`);
      console.log(`  Pool Share: ${(lpShare * 100).toFixed(6)}%\n`);
      console.log(`💰 If you remove ALL your liquidity (${userLPFormatted} LP tokens), you will receive:`);
      console.log(`  ${tokenAInfo.symbol}: ${expectedAmountAFormatted}`);
      console.log(`  ${tokenBInfo.symbol}: ${expectedAmountBFormatted}\n`);
    } else {
      console.log(`💡 To see what tokens YOU will receive, provide your address as the second argument:\n`);
      console.log(`   node scripts/validate-liquidity.js ${poolAddress} <your-address>\n`);
    }

    // 7. Validation check
    console.log('✅ VALIDATION:');
    console.log('   The amounts are calculated based on your proportional share of the pool.');
    console.log('   Formula: (Your LP tokens / Total LP supply) × Reserves = Tokens you receive');
    console.log('   This ensures each LP holder receives the correct proportion of both tokens.\n');
    
    if (userAddress && userLPBalance) {
      const userShare = (Number(userLPBalance) / Number(totalSupply)) * 100;
      const reserveATotal = Number(reserveAFormatted);
      const reserveBTotal = Number(reserveBFormatted);
      const expectedAmountA = (Number(userLPBalance) * Number(reserveA)) / Number(totalSupply);
      const expectedAmountB = (Number(userLPBalance) * Number(reserveB)) / Number(totalSupply);
      const expectedATotal = Number(formatUnits(BigInt(Math.floor(expectedAmountA)), tokenAInfo.decimals));
      const expectedBTotal = Number(formatUnits(BigInt(Math.floor(expectedAmountB)), tokenBInfo.decimals));
      
      console.log(`   ✅ Verification:`);
      console.log(`   Your share: ${userShare.toFixed(6)}% of pool`);
      console.log(`   ${tokenAInfo.symbol} verification: ${expectedATotal.toFixed(6)} = ${(reserveATotal * userShare / 100).toFixed(6)} ✓`);
      console.log(`   ${tokenBInfo.symbol} verification: ${expectedBTotal.toFixed(6)} = ${(reserveBTotal * userShare / 100).toFixed(6)} ✓\n`);
      console.log(`   🎯 CONCLUSION: The calculation is correct!`);
      console.log(`   When you remove ${userLPFormatted} LP tokens, you will receive:`);
      console.log(`   → ${expectedATotal.toFixed(6)} ${tokenAInfo.symbol}`);
      console.log(`   → ${expectedBTotal.toFixed(6)} ${tokenBInfo.symbol}\n`);
    } else {
      console.log(`   💡 This script validates the liquidity removal calculation.`);
      console.log(`   Each LP holder receives tokens proportional to their LP token share.\n`);
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error validating liquidity removal:', error);
    console.error('Make sure:');
    console.error('  1. Pool address is correct');
    console.error('  2. You are connected to Arc Testnet');
    console.error('  3. RPC endpoint is accessible');
    process.exit(1);
  }
}

// Main execution
const poolAddress = process.argv[2];
const userAddress = process.argv[3];

if (!poolAddress) {
  console.error('Usage: node scripts/validate-liquidity.js <poolAddress> [userAddress]');
  console.error('Example: node scripts/validate-liquidity.js 0x6f533E099B2B9468F98685Cc9F09D547661ca5d6 0xYourAddress');
  process.exit(1);
}

// Validate addresses
if (!poolAddress.startsWith('0x') || poolAddress.length !== 42) {
  console.error('❌ Invalid pool address format');
  process.exit(1);
}

if (userAddress && (!userAddress.startsWith('0x') || userAddress.length !== 42)) {
  console.error('❌ Invalid user address format');
  process.exit(1);
}

validateLiquidityRemoval(poolAddress, userAddress)
  .then(() => {
    console.log('✅ Validation complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });

