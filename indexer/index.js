/**
 * DEX Indexer for Railway
 * 
 * This indexer listens to blockchain events and stores swap data in Supabase:
 * - Listens to PoolCreated events from the Factory
 * - Listens to Swap events from all pools
 * - Calculates volume and fees
 * - Stores daily metrics in Supabase
 * 
 * Run with: node index.js
 */

// Load environment variables from .env file
require('dotenv').config();

const { createPublicClient, http, parseAbiItem } = require('viem');
const { createClient } = require('@supabase/supabase-js');

// DEX Configuration
const DEX_CONFIG = {
  FACTORY_ADDRESS: "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C",
  CHAIN_ID: 5042002,
  EXPLORER_URL: "https://testnet.arcscan.app",
};

// Factory ABI (minimal - only functions we need)
const FACTORY_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'allPools',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'allPoolsLength',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Pool ABI (minimal - only functions we need)
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
    name: 'reserveA',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'reserveB',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint256', name: '_reserveA', type: 'uint256' },
      { internalType: 'uint256', name: '_reserveB', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// ERC20 ABI for getting token symbols, decimals, and balances
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

// Known tokens (for USDC address)
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'; // Arc Testnet USDC
const KNOWN_TOKENS = {
  '0x3600000000000000000000000000000000000000': { symbol: 'USDC', decimals: 6 },
  '0x49cd69442dB073E7b94B0124e316AB7C68b95988': { symbol: 'SRAC', decimals: 18 },
  '0x6E63e2cABECCe5c3A1c37b79A958a9542076A1e3': { symbol: 'RACS', decimals: 18 },
  '0x63F856fBAB3535174bFaFD6EFd720C634d6FD458': { symbol: 'SACS', decimals: 18 },
  // Old tokens (for backwards compatibility)
  
};

// Environment variables
const HTTP_RPC_URL = process.env.HTTP_RPC_URL || process.env.RPC_URL || 'https://rpc.testnet.arc.network';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

// Arc Testnet chain config
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
};

// HTTP RPC client for ALL operations
// Use HTTP RPC (Alchemy or other provider)
let rpcClient;
try {
  rpcClient = createPublicClient({
    chain: arcTestnet,
    transport: http(HTTP_RPC_URL, {
      batch: false, // No batching - ensure fresh reads
    }),
    cacheTime: 0, // No caching - always fetch fresh data
  });
  console.log('✓ HTTP RPC client initialized');
} catch (error) {
  console.error('✗ Error initializing HTTP RPC client:', error);
  throw error;
}

const supabase = SUPABASE_URL && SUPABASE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// Log Supabase configuration status on startup
console.log('\n=== Indexer Configuration ===');
console.log('HTTP_RPC_URL:', HTTP_RPC_URL ? HTTP_RPC_URL : 'MISSING');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'SET (' + SUPABASE_URL.substring(0, 30) + '...)' : 'MISSING');
console.log('SUPABASE_KEY:', SUPABASE_KEY ? 'SET (' + SUPABASE_KEY.substring(0, 20) + '...)' : 'MISSING');
console.log('Supabase client:', supabase ? '✓ INITIALIZED' : '✗ NOT INITIALIZED');
console.log('HTTP RPC client:', rpcClient ? '✓ INITIALIZED' : '✗ NOT INITIALIZED');
console.log('============================\n');

// Track known pools
const knownPools = new Set();
let lastProcessedBlock = null;
let lastMaterializedViewRefresh = null; // Track when we last refreshed materialized views
let lastPoolVolume24hRefresh = null; // Track when we last refreshed pool_volume_24h (hourly)
let lastPoolFeesTotalRefresh = null; // Track when we last refreshed pool_fees_total (daily)


/**
 * Fetch all pools from factory
 */
async function fetchAllPools() {
  try {
    // Use HTTP RPC
    const poolCount = await rpcClient.readContract({
      address: DEX_CONFIG.FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'allPoolsLength',
    });

    const pools = [];
    for (let i = 0; i < Number(poolCount); i++) {
      try {
        const poolAddress = await rpcClient.readContract({
          address: DEX_CONFIG.FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'allPools',
          args: [BigInt(i)],
        });

        if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
          pools.push(poolAddress);
          knownPools.add(poolAddress.toLowerCase());
        }
      } catch (error) {
        console.error(`Error fetching pool ${i}:`, error);
      }
    }

    return pools;
  } catch (error) {
    console.error('Error fetching pools:', error);
    return [];
  }
}

/**
 * Process Swap events from a pool using HTTP RPC
 */
async function processSwapEvents(poolAddress, fromBlock, toBlock) {
  try {
    const swapEventAbi = parseAbiItem(
      'event Swap(address indexed sender, uint256 amountAIn, uint256 amountBIn, uint256 amountAOut, uint256 amountBOut, address indexed to)'
    );

    // Use HTTP RPC
    const logs = await rpcClient.getLogs({
      address: poolAddress,
      event: swapEventAbi,
      fromBlock,
      toBlock,
    });

    // Get pool token addresses (use HTTP RPC)
    const [tokenA, tokenB] = await Promise.all([
      rpcClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'tokenA',
      }),
      rpcClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'tokenB',
      }),
    ]);

    const events = [];

    for (const log of logs) {
      const args = log.args;
      if (!args) continue;

      const amountAIn = args.amountAIn || BigInt(0);
      const amountBIn = args.amountBIn || BigInt(0);
      const amountAOut = args.amountAOut || BigInt(0);
      const amountBOut = args.amountBOut || BigInt(0);

      // Determine swap direction
      let tokenIn, tokenOut, amountIn, amountOut;

      if (amountAIn > 0) {
        tokenIn = tokenA;
        tokenOut = tokenB;
        amountIn = amountAIn;
        amountOut = amountBOut;
      } else if (amountBIn > 0) {
        tokenIn = tokenB;
        tokenOut = tokenA;
        amountIn = amountBIn;
        amountOut = amountAOut;
      } else {
        continue;
      }

      // Get block timestamp (use HTTP RPC)
      const block = await rpcClient.getBlock({ blockNumber: log.blockNumber });
      const timestamp = Number(block.timestamp) * 1000;

      // Get sender address from event (first indexed parameter)
      const sender = args.sender || null;

      events.push({
        poolAddress,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        timestamp,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        sender: sender ? sender.toLowerCase() : null,
      });
    }

    return events;
  } catch (error) {
    console.error(`Error processing swap events for pool ${poolAddress}:`, error);
    return [];
  }
}

/**
 * Get token symbol and decimals
 */
async function getTokenInfo(tokenAddress) {
  const tokenLower = tokenAddress.toLowerCase();
  
  // Check known tokens first
  for (const [addr, info] of Object.entries(KNOWN_TOKENS)) {
    if (addr.toLowerCase() === tokenLower) {
      return info;
    }
  }

  // Fetch from contract (use HTTP RPC)
  try {
    const [symbol, decimals] = await Promise.all([
      rpcClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => null),
      rpcClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }).catch(() => 18),
    ]);

    return {
      symbol: symbol || tokenAddress.slice(0, 6) + '...',
      decimals: Number(decimals) || 18,
    };
  } catch (error) {
    return {
      symbol: tokenAddress.slice(0, 6) + '...',
      decimals: 18,
    };
  }
}

/**
 * Get token price in USD (simplified - use USDC as base)
 */
async function getTokenPriceInUSD(tokenAddress, pools) {
  // USDC is always $1 (Arc uses USDC as native currency)
  if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
    return 1;
  }

  // Try to find USDC pair (use HTTP RPC)
  for (const poolAddress of pools) {
    try {
      const [tokenA, tokenB] = await Promise.all([
        rpcClient.readContract({
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'tokenA',
        }),
        rpcClient.readContract({
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'tokenB',
        }),
      ]);

      const tokenALower = tokenA.toLowerCase();
      const tokenBLower = tokenB.toLowerCase();
      const tokenAddrLower = tokenAddress.toLowerCase();

      if (tokenALower === USDC_ADDRESS.toLowerCase() && tokenBLower === tokenAddrLower) {
        // Get reserves to calculate price (use HTTP RPC)
        const [reserveA, reserveB] = await Promise.all([
          rpcClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'reserveA',
          }),
          rpcClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'reserveB',
          }),
        ]);

        // Get token decimals
        const tokenInfo = await getTokenInfo(tokenB);
        const usdcDecimals = 6;
        
        // Price = USDC reserve / Token reserve
        const reserveAFormatted = Number(reserveA) / (10 ** usdcDecimals);
        const reserveBFormatted = Number(reserveB) / (10 ** tokenInfo.decimals);
        if (reserveBFormatted > 0) {
          return reserveAFormatted / reserveBFormatted;
        }
      } else if (tokenBLower === USDC_ADDRESS.toLowerCase() && tokenALower === tokenAddrLower) {
        // USDC is tokenB (use HTTP RPC)
        const [reserveA, reserveB] = await Promise.all([
          rpcClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'reserveA',
          }),
          rpcClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'reserveB',
          }),
        ]);

        const tokenInfo = await getTokenInfo(tokenA);
        const usdcDecimals = 6;
        
        const reserveAFormatted = Number(reserveA) / (10 ** tokenInfo.decimals);
        const reserveBFormatted = Number(reserveB) / (10 ** usdcDecimals);
        if (reserveAFormatted > 0) {
          return reserveBFormatted / reserveAFormatted;
        }
      }
    } catch (error) {
      // Continue to next pool
      continue;
    }
  }

  return 0; // Unknown price
}

/**
 * Store swap events in Supabase
 * Only stores raw swap events - volume/fees calculated on frontend from USDC amounts
 * Filters out swaps with value less than 5 USDC
 */
async function storeSwapEvents(events, pools) {
  if (!supabase || events.length === 0) return;

  try {
    const MIN_SWAP_VALUE_USD = 5; // Minimum swap value in USD to index
    let storedCount = 0;
    let filteredCount = 0;

    for (const event of events) {
      // Get token info for the input token
      const tokenInInfo = await getTokenInfo(event.tokenIn);
      
      // Calculate USD value of the swap
      const tokenInPrice = await getTokenPriceInUSD(event.tokenIn, pools);
      const amountInFormatted = Number(event.amountIn) / (10 ** tokenInInfo.decimals);
      const swapValueUSD = amountInFormatted * tokenInPrice;

      // Only store swaps with value >= 5 USDC
      if (swapValueUSD >= MIN_SWAP_VALUE_USD) {
        // Store individual swap event (raw data)
        await supabase.from('swap_events').upsert({
          tx_hash: event.txHash,
          pool_address: event.poolAddress.toLowerCase(),
          token_in: event.tokenIn.toLowerCase(),
          token_out: event.tokenOut.toLowerCase(),
          amount_in: event.amountIn.toString(),
          amount_out: event.amountOut.toString(),
          block_number: event.blockNumber.toString(),
          timestamp: new Date(event.timestamp).toISOString(),
          sender_address: event.sender || null,
        }, {
          onConflict: 'tx_hash',
        });
        storedCount++;
      } else {
        filteredCount++;
      }
    }

    if (filteredCount > 0) {
      console.log(`✓ Stored ${storedCount} swap events (filtered out ${filteredCount} swaps < $${MIN_SWAP_VALUE_USD} USD)`);
    } else {
      console.log(`✓ Stored ${storedCount} swap events`);
    }
  } catch (error) {
    console.error('✗ Error storing swap events:', error);
  }
}

/**
 * Main indexing function
 */
async function index() {
  console.log('Starting DEX indexer...');

  // Fetch all pools
  const pools = await fetchAllPools();
  console.log(`Found ${pools.length} pools`);

  // Get current block (use HTTP RPC)
  const currentBlock = await rpcClient.getBlockNumber();

  // Initialize last processed block if needed
  if (!lastProcessedBlock) {
    // Start from current block (real-time indexing only)
    // Only look back 100 blocks for safety to catch any recent events
    lastProcessedBlock = currentBlock - BigInt(100);
    console.log(`Starting indexer from block ${lastProcessedBlock} (current: ${currentBlock})`);
  }

  const fromBlock = lastProcessedBlock + BigInt(1);
  let toBlock = currentBlock;

  // Safety: Limit block range to max 1000 blocks per iteration to prevent timeouts
  const MAX_BLOCKS_PER_ITERATION = BigInt(1000);
  if (toBlock - fromBlock > MAX_BLOCKS_PER_ITERATION) {
    console.log(`⚠️ Block range too large (${toBlock - fromBlock} blocks), limiting to ${MAX_BLOCKS_PER_ITERATION} blocks`);
    toBlock = fromBlock + MAX_BLOCKS_PER_ITERATION;
  }

  if (fromBlock > toBlock) {
    console.log('No new blocks to process, but updating pool reserves from on-chain anyway...');
    // Even if no new blocks, still update reserves (liquidity might have been added)
    // Continue to update pool data below
  }

  // Process swaps from all pools (only if there are new blocks)
  let allSwapEvents = [];
  
  if (fromBlock <= toBlock) {
    console.log(`Processing blocks ${fromBlock} to ${toBlock} for swap events`);
    for (const poolAddress of pools) {
      const events = await processSwapEvents(poolAddress, fromBlock, toBlock);
      allSwapEvents.push(...events);
    }
  }

  // Also listen for new PoolCreated events (only if there are new blocks)
  if (fromBlock <= toBlock) {
    const poolCreatedAbi = parseAbiItem(
      'event PoolCreated(address indexed tokenA, address indexed tokenB, address pool, uint256)'
    );

    // Use HTTP RPC
    const poolCreatedLogs = await rpcClient.getLogs({
      address: DEX_CONFIG.FACTORY_ADDRESS,
      event: poolCreatedAbi,
      fromBlock,
      toBlock,
    });

    // Add newly created pools
    for (const log of poolCreatedLogs) {
      const args = log.args;
      if (args?.pool) {
        const newPool = args.pool;
        if (!knownPools.has(newPool.toLowerCase())) {
          knownPools.add(newPool.toLowerCase());
          pools.push(newPool);
          console.log(`New pool created: ${newPool}`);
        }
      }
    }
  }
  
  // IMPORTANT: Always update last processed block, even if no new blocks
  // This ensures we continue polling correctly
  if (fromBlock <= toBlock) {
    lastProcessedBlock = toBlock;
  }

  // Store events in Supabase
  if (allSwapEvents.length > 0) {
    await storeSwapEvents(allSwapEvents, pools);
  }

  // ALWAYS update pool reserves from on-chain (even if no swaps happened)
  // This ensures reserves are always fresh when new liquidity is added
  // On-chain is the source of truth - we fetch fresh reserves every poll
  console.log('Updating pool reserves from on-chain (source of truth)...');
  await storePoolData(pools);
  console.log('Pool reserves updated from on-chain');

  console.log(`Indexed ${allSwapEvents.length} swap events`);

  // Refresh materialized views every 10 minutes to keep aggregated data up to date
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds
  const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
  const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Refresh volume_fees views every 10 minutes
  if (!lastMaterializedViewRefresh || (now - lastMaterializedViewRefresh) >= TEN_MINUTES) {
    try {
      console.log('🔄 Refreshing volume_fees materialized views (every 10 minutes)...');
      const { error } = await supabase.rpc('refresh_volume_fees_views');
      if (error) {
        console.error('Error refreshing volume_fees views:', error);
      } else {
        console.log('✅ Volume_fees views refreshed successfully');
        lastMaterializedViewRefresh = now;
      }
    } catch (error) {
      console.error('Exception refreshing volume_fees views:', error);
    }
  }
  
  // Refresh pool_volume_24h view every 1 hour (24h volume doesn't need frequent updates)
  if (!lastPoolVolume24hRefresh || (now - lastPoolVolume24hRefresh) >= ONE_HOUR) {
    try {
      console.log('🔄 Refreshing pool_volume_24h materialized view (every 1 hour)...');
      const { error } = await supabase.rpc('refresh_pool_volume_24h');
      if (error) {
        console.error('Error refreshing pool_volume_24h view:', error);
      } else {
        console.log('✅ Pool_volume_24h view refreshed successfully');
        lastPoolVolume24hRefresh = now;
      }
    } catch (error) {
      console.error('Exception refreshing pool_volume_24h view:', error);
    }
  }
  
  // Refresh pool_fees_total view every 24 hours (total fees don't need frequent updates)
  if (!lastPoolFeesTotalRefresh || (now - lastPoolFeesTotalRefresh) >= ONE_DAY) {
    try {
      console.log('🔄 Refreshing pool_fees_total materialized view (every 24 hours)...');
      const { error } = await supabase.rpc('refresh_pool_fees_total');
      if (error) {
        console.error('Error refreshing pool_fees_total view:', error);
      } else {
        console.log('✅ Pool_fees_total view refreshed successfully');
        lastPoolFeesTotalRefresh = now;
      }
    } catch (error) {
      console.error('Exception refreshing pool_fees_total view:', error);
    }
  }
}

/**
 * Store price history snapshot for a pool
 * Only stores if it's been at least 50 seconds since last snapshot (to avoid excessive writes)
 */
async function storePriceHistory(poolAddress, tokenA, tokenB, tokenAInfo, tokenBInfo, reserveA, reserveB) {
  if (!supabase) return;

  try {
    // Calculate prices
    const reserveAFormatted = Number(reserveA) / (10 ** tokenAInfo.decimals);
    const reserveBFormatted = Number(reserveB) / (10 ** tokenBInfo.decimals);

    // Price of tokenA in terms of tokenB (how many tokenB per tokenA)
    const priceAperB = reserveBFormatted / reserveAFormatted;
    // Price of tokenB in terms of tokenA (how many tokenA per tokenB)
    const priceBperA = reserveAFormatted / reserveBFormatted;

    // Get current timestamp
    const now = new Date();

    // Check last snapshot time for this pool (to throttle writes)
    const { data: lastSnapshot } = await supabase
      .from('price_history')
      .select('timestamp')
      .eq('pool_address', poolAddress.toLowerCase())
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Only store if last snapshot was more than 50 seconds ago (or no previous snapshot)
    if (!lastSnapshot || (now - new Date(lastSnapshot.timestamp)) > 50000) {
      const { error } = await supabase.from('price_history').insert({
        pool_address: poolAddress.toLowerCase(),
        token_a: tokenA.toLowerCase(),
        token_b: tokenB.toLowerCase(),
        token_a_symbol: tokenAInfo.symbol,
        token_b_symbol: tokenBInfo.symbol,
        price_a_per_b: priceAperB,
        price_b_per_a: priceBperA,
        reserve_a: reserveA.toString(),
        reserve_b: reserveB.toString(),
        timestamp: now.toISOString(),
      });

      if (error && !error.message.includes('duplicate key')) {
        console.error(`Error storing price history for ${poolAddress}:`, error);
      }
      // Silent success - don't spam logs for every price snapshot
    }
  } catch (error) {
    // Silent fail - price history is not critical
    console.error(`Error in storePriceHistory for ${poolAddress}:`, error);
  }
}

/**
 * Fetch and store pool data in Supabase
 */
async function storePoolData(pools) {
  console.log(`storePoolData called with ${pools.length} pools, supabase:`, !!supabase);
  
  if (!supabase) {
    console.error('ERROR: Supabase client not initialized! Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    return;
  }
  
  if (pools.length === 0) {
    console.log('No pools to store');
    return;
  }

  console.log(`Starting to store ${pools.length} pools...`);

  try {
    for (const poolAddress of pools) {
      try {
        // Fetch FRESH reserves directly from on-chain (this is the source of truth)
        // Use HTTP RPC for all reads
        // Get current block for logging only
        const currentBlock = await rpcClient.getBlockNumber();
        console.log(`  Reading reserves for ${poolAddress} (current block: ${currentBlock.toString()})`);
        
        // Fetch tokens first (using HTTP RPC)
        const [tokenA, tokenB] = await Promise.all([
          rpcClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'tokenA',
          }),
          rpcClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'tokenB',
          }),
        ]);
        
        // CRITICAL: Read ACTUAL token balances from ERC20 contracts, not stored reserves
        // This is the real on-chain truth - balances are always accurate!
        // Stored reserves might be stale if _update() wasn't called
        // Use HTTP RPC for all reads
        const [reserveA, reserveB] = await Promise.all([
          // Read Token A balance directly from ERC20 contract
          rpcClient.readContract({
            address: tokenA,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [poolAddress], // Pool's balance of tokenA
          }),
          // Read Token B balance directly from ERC20 contract
          rpcClient.readContract({
            address: tokenB,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [poolAddress], // Pool's balance of tokenB
          }),
        ]);
        
        // Log the raw on-chain reserves (actual token balances) for verification
        console.log(`  Pool ${poolAddress}: reserveA=${reserveA.toString()}, reserveB=${reserveB.toString()}`);

        // Get token symbols and decimals
        const [tokenAInfo, tokenBInfo] = await Promise.all([
          getTokenInfo(tokenA),
          getTokenInfo(tokenB),
        ]);

        // Calculate TVL in USD
        const tokenAPrice = await getTokenPriceInUSD(tokenA, pools);
        const tokenBPrice = await getTokenPriceInUSD(tokenB, pools);

        const reserveAFormatted = Number(reserveA) / (10 ** tokenAInfo.decimals);
        const reserveBFormatted = Number(reserveB) / (10 ** tokenBInfo.decimals);

        const reserveAValue = reserveAFormatted * tokenAPrice;
        const reserveBValue = reserveBFormatted * tokenBPrice;
        const totalLiquidity = reserveAValue + reserveBValue;

        // Only store pools with liquidity
        if (reserveAFormatted > 0.000001 && reserveBFormatted > 0.000001) {
          const { error: upsertError } = await supabase.from('pools').upsert({
            pool_address: poolAddress.toLowerCase(),
            token_a: tokenA.toLowerCase(),
            token_b: tokenB.toLowerCase(),
            token_a_symbol: tokenAInfo.symbol,
            token_b_symbol: tokenBInfo.symbol,
            reserve_a: reserveA.toString(),
            reserve_b: reserveB.toString(),
            reserve_a_decimals: tokenAInfo.decimals,
            reserve_b_decimals: tokenBInfo.decimals,
            total_liquidity: totalLiquidity,
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'pool_address',
          });

          if (upsertError) {
            console.error(`✗ Error upserting pool ${poolAddress}:`, upsertError);
          } else {
            console.log(`✓ Updated pool ${poolAddress} (${tokenAInfo.symbol}/${tokenBInfo.symbol})`);
            console.log(`  Reserves: ${reserveAFormatted.toFixed(6)} ${tokenAInfo.symbol} / ${reserveBFormatted.toFixed(6)} ${tokenBInfo.symbol}`);
            console.log(`  TVL: $${totalLiquidity.toFixed(2)}`);
            
            // Store price history snapshot (for charts)
            await storePriceHistory(
              poolAddress,
              tokenA,
              tokenB,
              tokenAInfo,
              tokenBInfo,
              reserveA,
              reserveB
            );
          }
        } else {
          // Remove pool from Supabase if it has no liquidity
          const { error: deleteError } = await supabase.from('pools').delete().eq('pool_address', poolAddress.toLowerCase());
          if (deleteError) {
            console.error(`Error deleting pool ${poolAddress}:`, deleteError);
          } else {
            console.log(`✗ Removed pool ${poolAddress} (no liquidity)`);
          }
        }
      } catch (error) {
        console.error(`Error storing pool data for ${poolAddress}:`, error);
      }
    }

    // Verify storage
    const { data, error: verifyError } = await supabase.from('pools').select('pool_address').limit(10);
    if (verifyError) {
      console.error('✗ Error verifying pool storage:', verifyError);
    } else {
      console.log(`✓ Successfully updated pools in Supabase (${data?.length || 0} pools currently in database)`);
    }
  } catch (error) {
    console.error('✗ CRITICAL ERROR in storePoolData:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

/**
 * Test HTTP RPC connection health
 */
async function testRPCConnection() {
  try {
    // Try a simple read to test connection
    const blockNumber = await rpcClient.getBlockNumber();
    return { healthy: true, blockNumber };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Run indexer in polling loop
 * Uses HTTP RPC for all operations
 * Polls every 10 seconds to keep up with chain activity
 * Automatically restarts every 2 hours to prevent RPC errors
 */
async function run() {
  const startTime = Date.now();
  const RESTART_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  
  console.log('Starting indexer polling loop with HTTP RPC...');
  console.log(`⏰ Scheduled restart in 2 hours (${new Date(startTime + RESTART_INTERVAL_MS).toISOString()})`);
  
  // Test HTTP RPC connection on startup
  const rpcHealth = await testRPCConnection();
  if (rpcHealth.healthy) {
    console.log(`✓ HTTP RPC connection healthy (current block: ${rpcHealth.blockNumber})`);
  } else {
    console.warn(`⚠️ HTTP RPC connection test failed: ${rpcHealth.error}`);
  }
  
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;
  let lastTimeRemainingLog = 0;
  
  while (true) {
    // Check if 2 hours have elapsed - if so, gracefully exit for restart
    const elapsed = Date.now() - startTime;
    if (elapsed >= RESTART_INTERVAL_MS) {
      const hours = (elapsed / (60 * 60 * 1000)).toFixed(2);
      console.log(`\n⏰ 2-hour restart interval reached (ran for ${hours} hours)`);
      console.log('🔄 Gracefully shutting down for automatic restart...');
      console.log('   Railway will automatically restart this service.\n');
      process.exit(0); // Exit gracefully - Railway will restart
    }
    
    // Log time remaining every 30 minutes
    const timeRemaining = RESTART_INTERVAL_MS - elapsed;
    const minutesRemaining = Math.floor(timeRemaining / (60 * 1000));
    const currentInterval = Math.floor(elapsed / (30 * 60 * 1000));
    if (minutesRemaining > 0 && minutesRemaining % 30 === 0 && currentInterval !== lastTimeRemainingLog) {
      const hoursRemaining = (minutesRemaining / 60).toFixed(1);
      console.log(`⏰ Time until restart: ${hoursRemaining} hours (${minutesRemaining} minutes)`);
      lastTimeRemainingLog = currentInterval;
    }
    
    try {
      await index();
      consecutiveErrors = 0; // Reset error counter on success
    } catch (error) {
      consecutiveErrors++;
      console.error(`Indexing error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error.message || error);
      // Log full error details but don't crash
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
      
      // If too many consecutive errors, test RPC connection
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log('⚠️ Too many consecutive errors, testing HTTP RPC connection...');
        const health = await testRPCConnection();
        if (!health.healthy) {
          console.error('✗ HTTP RPC connection unhealthy');
        } else {
          console.log('✓ HTTP RPC connection is healthy, resetting error counter');
          consecutiveErrors = 0;
        }
      }
    }

    // Wait 10 seconds before next poll (don't restart, just wait)
    console.log('Waiting 10 seconds before next poll...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

// Handle uncaught errors to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log and continue
});

// Start the indexer (should run indefinitely)
console.log('🚀 Initializing DEX Indexer...');
console.log('📍 Working directory:', process.cwd());
console.log('📦 Node version:', process.version);
console.log('');

// Validate environment before starting
if (!HTTP_RPC_URL) {
  console.error('❌ ERROR: HTTP_RPC_URL or RPC_URL environment variable is not set!');
  console.error('   Please set HTTP_RPC_URL or RPC_URL in Railway environment variables');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERROR: Supabase credentials not set!');
  console.error('   Please set SUPABASE_URL and SUPABASE_ANON_KEY in Railway environment variables');
  process.exit(1);
}

run().catch((error) => {
  console.error('❌ Fatal error in run loop:', error);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  // Even on fatal error, try to restart after 30 seconds
  setTimeout(() => {
    console.log('🔄 Attempting to restart indexer after error...');
    run().catch(console.error);
  }, 30000);
});

module.exports = { index, run };



