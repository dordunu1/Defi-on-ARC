/**
 * Staking Indexer Module
 * 
 * Handles all staking-related indexing:
 * - Processes Staked/Unstaked events
 * - Updates accumulated DOA rewards for stakers
 * - Continuously monitors for new staking events
 */

const { parseAbiItem } = require('viem');

// StakingRewards ABI (minimal - only functions we need)
const STAKING_REWARDS_ABI = [
  {
    inputs: [],
    name: 'getAllPools',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'poolAddress', type: 'address' }],
    name: 'getPoolInfo',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'lpToken', type: 'address' },
          { internalType: 'uint256', name: 'rewardRate', type: 'uint256' },
          { internalType: 'uint256', name: 'lastUpdateTime', type: 'uint256' },
          { internalType: 'uint256', name: 'rewardPerTokenStored', type: 'uint256' },
          { internalType: 'uint256', name: 'totalStaked', type: 'uint256' },
          { internalType: 'bool', name: 'isActive', type: 'bool' },
        ],
        internalType: 'struct StakingRewards.PoolInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'poolAddress', type: 'address' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'getStakerInfo',
    outputs: [
      { internalType: 'uint256', name: 'stakedAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'accumulatedRewards', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Process Staked/Unstaked events and store them in database
 * Also immediately updates staking_positions table so UI reflects changes instantly
 */
async function processStakingEvents(fromBlock, toBlock, rpcClient, supabase, stakingRewardsAddress, isRateLimitError) {
  if (!supabase || !stakingRewardsAddress || stakingRewardsAddress === '') {
    return;
  }

  try {
    const stakeEventAbi = parseAbiItem(
      'event Staked(address indexed pool, address indexed user, uint256 amount)'
    );
    const unstakeEventAbi = parseAbiItem(
      'event Unstaked(address indexed pool, address indexed user, uint256 amount)'
    );

    // Get Staked events
    const stakeLogs = await rpcClient.getLogs({
      address: stakingRewardsAddress,
      event: stakeEventAbi,
      fromBlock,
      toBlock,
    });

    // Get Unstaked events
    const unstakeLogs = await rpcClient.getLogs({
      address: stakingRewardsAddress,
      event: unstakeEventAbi,
      fromBlock,
      toBlock,
    });

    // Track pools that need total_staked updates
    const poolsToUpdate = new Set();

    // Process Staked events
    for (const log of stakeLogs) {
      try {
        const args = log.args;
        if (!args || !args.pool || !args.user) continue;

        poolsToUpdate.add(args.pool.toLowerCase());

        const block = await rpcClient.getBlock({ blockNumber: log.blockNumber });
        const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

        // Write event to staking_events table
        const { error: upsertError } = await supabase.from('staking_events').upsert({
          tx_hash: log.transactionHash,
          event_type: 'stake',
          user_address: args.user.toLowerCase(),
          pool_address: args.pool.toLowerCase(),
          amount: args.amount.toString(),
          block_number: log.blockNumber.toString(),
          timestamp: timestamp,
        }, {
          onConflict: 'tx_hash',
        });

        if (upsertError) {
          console.error(`❌ Error writing Staked event to Supabase (tx: ${log.transactionHash}):`, upsertError.message);
        } else {
          console.log(`✓ Wrote Staked event to Supabase: ${args.user.toLowerCase()} staked ${args.amount.toString()} in pool ${args.pool.toLowerCase()}`);
          
          // CRITICAL: Immediately update staking_positions table so UI reflects changes instantly
          // Get current staker info from contract to get accurate staked amount and rewards
          try {
            const stakerInfo = await rpcClient.readContract({
              address: stakingRewardsAddress,
              abi: STAKING_REWARDS_ABI,
              functionName: 'getStakerInfo',
              args: [args.pool, args.user],
            });

            // viem returns tuples as arrays: [stakedAmount, accumulatedRewards]
            const stakedAmount = Array.isArray(stakerInfo) ? stakerInfo[0] : (stakerInfo.stakedAmount || 0n);
            const accumulatedRewards = Array.isArray(stakerInfo) ? stakerInfo[1] : (stakerInfo.accumulatedRewards || 0n);

            // Update staking_positions immediately
            const { error: positionError } = await supabase.from('staking_positions').upsert({
              user_address: args.user.toLowerCase(),
              pool_address: args.pool.toLowerCase(),
              staked_amount: stakedAmount.toString(),
              accumulated_rewards: accumulatedRewards.toString(),
              last_updated: new Date().toISOString(),
            }, {
              onConflict: 'user_address,pool_address',
            });

            if (positionError) {
              console.error(`❌ Error updating staking position for ${args.user.toLowerCase()}:`, positionError.message);
            } else {
              console.log(`✓ Updated staking position: ${args.user.toLowerCase()} now has ${stakedAmount.toString()} staked`);
            }
          } catch (positionErr) {
            console.warn(`⚠️ Could not update staking position for ${args.user.toLowerCase()}:`, positionErr.message);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing Staked event (tx: ${log.transactionHash}):`, error.message);
        if (error.stack) {
          console.error('Stack:', error.stack);
        }
      }
    }

    // Process Unstaked events
    for (const log of unstakeLogs) {
      try {
        const args = log.args;
        if (!args || !args.pool || !args.user) continue;

        poolsToUpdate.add(args.pool.toLowerCase());

        const block = await rpcClient.getBlock({ blockNumber: log.blockNumber });
        const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

        // Write event to staking_events table
        const { error: upsertError } = await supabase.from('staking_events').upsert({
          tx_hash: log.transactionHash,
          event_type: 'unstake',
          user_address: args.user.toLowerCase(),
          pool_address: args.pool.toLowerCase(),
          amount: args.amount.toString(),
          block_number: log.blockNumber.toString(),
          timestamp: timestamp,
        }, {
          onConflict: 'tx_hash',
        });

        if (upsertError) {
          console.error(`❌ Error writing Unstaked event to Supabase (tx: ${log.transactionHash}):`, upsertError.message);
        } else {
          console.log(`✓ Wrote Unstaked event to Supabase: ${args.user.toLowerCase()} unstaked ${args.amount.toString()} from pool ${args.pool.toLowerCase()}`);
          
          // CRITICAL: Immediately update staking_positions table so UI reflects changes instantly
          // Get current staker info from contract to get accurate staked amount and rewards
          try {
            const stakerInfo = await rpcClient.readContract({
              address: stakingRewardsAddress,
              abi: STAKING_REWARDS_ABI,
              functionName: 'getStakerInfo',
              args: [args.pool, args.user],
            });

            // viem returns tuples as arrays: [stakedAmount, accumulatedRewards]
            const stakedAmount = Array.isArray(stakerInfo) ? stakerInfo[0] : (stakerInfo.stakedAmount || 0n);
            const accumulatedRewards = Array.isArray(stakerInfo) ? stakerInfo[1] : (stakerInfo.accumulatedRewards || 0n);

            // Update staking_positions immediately
            if (stakedAmount > 0n || accumulatedRewards > 0n) {
              const { error: positionError } = await supabase.from('staking_positions').upsert({
                user_address: args.user.toLowerCase(),
                pool_address: args.pool.toLowerCase(),
                staked_amount: stakedAmount.toString(),
                accumulated_rewards: accumulatedRewards.toString(),
                last_updated: new Date().toISOString(),
              }, {
                onConflict: 'user_address,pool_address',
              });

              if (positionError) {
                console.error(`❌ Error updating staking position for ${args.user.toLowerCase()}:`, positionError.message);
              } else {
                console.log(`✓ Updated staking position: ${args.user.toLowerCase()} now has ${stakedAmount.toString()} staked`);
              }
            } else {
              // Remove position if user has nothing staked and no rewards
              const { error: deleteError } = await supabase
                .from('staking_positions')
                .delete()
                .eq('user_address', args.user.toLowerCase())
                .eq('pool_address', args.pool.toLowerCase());
              
              if (deleteError) {
                console.error(`❌ Error deleting staking position for ${args.user.toLowerCase()}:`, deleteError.message);
              } else {
                console.log(`✓ Removed staking position: ${args.user.toLowerCase()} has no stake remaining`);
              }
            }
          } catch (positionErr) {
            console.warn(`⚠️ Could not update staking position for ${args.user.toLowerCase()}:`, positionErr.message);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing Unstaked event (tx: ${log.transactionHash}):`, error.message);
        if (error.stack) {
          console.error('Stack:', error.stack);
        }
      }
    }

    // CRITICAL: Immediately update total_staked in staking_pools table for all affected pools
    // This ensures the UI shows updated total staked amounts instantly
    for (const poolAddress of poolsToUpdate) {
      try {
        const poolInfo = await rpcClient.readContract({
          address: stakingRewardsAddress,
          abi: STAKING_REWARDS_ABI,
          functionName: 'getPoolInfo',
          args: [poolAddress],
        });

        // Update staking_pools table with latest total_staked
        const { error: poolUpdateError } = await supabase.from('staking_pools').upsert({
          pool_address: poolAddress.toLowerCase(),
          lp_token: poolInfo.lpToken.toLowerCase(),
          reward_rate: poolInfo.rewardRate.toString(),
          total_staked: poolInfo.totalStaked.toString(),
          is_active: poolInfo.isActive,
          last_update_time: new Date(Number(poolInfo.lastUpdateTime) * 1000).toISOString(),
          reward_per_token_stored: poolInfo.rewardPerTokenStored.toString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'pool_address',
        });

        if (poolUpdateError) {
          console.error(`❌ Error updating total_staked for pool ${poolAddress}:`, poolUpdateError.message);
        } else {
          console.log(`✓ Updated total_staked for pool ${poolAddress}: ${poolInfo.totalStaked.toString()}`);
        }
      } catch (poolErr) {
        console.warn(`⚠️ Could not update total_staked for pool ${poolAddress}:`, poolErr.message);
      }
    }

    if (stakeLogs.length > 0 || unstakeLogs.length > 0) {
      console.log(`✓ Processed ${stakeLogs.length} Staked and ${unstakeLogs.length} Unstaked events from blocks ${fromBlock} to ${toBlock}`);
    } else {
      // Log when no events found (helps debug)
      if (fromBlock <= toBlock) {
        console.log(`  No staking events found in blocks ${fromBlock} to ${toBlock}`);
      }
    }
  } catch (error) {
    if (isRateLimitError(error)) {
      throw error; // Re-throw to trigger rate limit handling
    }
    console.warn('Error processing staking events:', error.message);
  }
}

/**
 * Continuous staking event indexer - runs independently to catch events immediately
 * Checks for new blocks every 5 seconds
 */
async function startContinuousStakingIndexer(rpcClient, supabase, stakingRewardsAddress, isRateLimitError) {
  if (!stakingRewardsAddress || !supabase) {
    return;
  }
  
  // Initialize last staking event block
  let lastBlock = null;
  
  while (true) {
    try {
      // Get current block
      const currentBlock = await rpcClient.getBlockNumber();
      
      // Initialize on first run - start from 100 blocks ago to catch recent events
      if (!lastBlock) {
        lastBlock = currentBlock > BigInt(100) ? currentBlock - BigInt(100) : BigInt(0);
        console.log(`📊 Continuous staking indexer initialized from block ${lastBlock} (current: ${currentBlock})`);
      }
      
      const fromBlock = lastBlock + BigInt(1);
      const toBlock = currentBlock;
      
      // Always process if there are new blocks (even if just 1 block)
      if (fromBlock <= toBlock) {
        // For continuous monitoring, process all new blocks (no limit for recent blocks)
        // This ensures we catch events immediately as they happen
        const blocksToProcess = toBlock - fromBlock + BigInt(1);
        
        // If there are many blocks to catch up, process in batches
        const MAX_BLOCKS_PER_CHECK = BigInt(200);
        let actualToBlock = toBlock;
        if (blocksToProcess > MAX_BLOCKS_PER_CHECK) {
          actualToBlock = fromBlock + MAX_BLOCKS_PER_CHECK - BigInt(1);
        }
        
        if (fromBlock <= actualToBlock) {
          await processStakingEvents(fromBlock, actualToBlock, rpcClient, supabase, stakingRewardsAddress, isRateLimitError);
          lastBlock = actualToBlock;
          
          // If we processed less than the full range, we'll catch up in next iteration
          if (actualToBlock < toBlock) {
            console.log(`📊 Processed ${actualToBlock - fromBlock + 1n} blocks, ${toBlock - actualToBlock} blocks remaining`);
          } else if (blocksToProcess > 0) {
            // Log when we process recent blocks to confirm we're catching events
            console.log(`📊 Processed ${blocksToProcess} new block(s) (${fromBlock} to ${actualToBlock})`);
          }
        }
      } else {
        // Even if no new blocks, check the last 20 blocks to catch any missed events
        // This ensures we don't miss events that happened between checks
        const recentFromBlock = currentBlock > BigInt(20) ? currentBlock - BigInt(20) : BigInt(0);
        if (recentFromBlock > lastBlock) {
          console.log(`📊 Checking recent blocks for missed events (${recentFromBlock} to ${currentBlock})...`);
          await processStakingEvents(recentFromBlock, currentBlock, rpcClient, supabase, stakingRewardsAddress, isRateLimitError);
          lastBlock = currentBlock;
        }
      }
      
      // Wait 3 seconds before next check (faster than main indexer for real-time detection)
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      if (isRateLimitError(error)) {
        // If rate limited, wait longer before retrying
        console.warn('⚠️ Rate limit in continuous staking indexer, waiting 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      } else {
        console.error('Error in continuous staking indexer:', error.message);
        // Wait 10 seconds on error before retrying
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
}

/**
 * Update accumulated DOA rewards for all stakers
 */
async function indexStakingData(rpcClient, supabase, stakingRewardsAddress) {
  if (!supabase) {
    console.log('⚠️ Skipping staking index: Supabase not configured');
    return;
  }
  if (!stakingRewardsAddress || stakingRewardsAddress === '') {
    console.log('⚠️ Skipping staking index: STAKING_REWARDS_ADDRESS not set');
    return;
  }

  try {
    console.log('🔄 Updating accumulated DOA rewards for all stakers...');

    // Get all pools from staking contract
    const allStakingPools = await rpcClient.readContract({
      address: stakingRewardsAddress,
      abi: STAKING_REWARDS_ABI,
      functionName: 'getAllPools',
    });

    if (!allStakingPools || allStakingPools.length === 0) {
      console.log('  No staking pools found');
      return;
    }

    console.log(`  Found ${allStakingPools.length} staking pools`);

    let totalStakersUpdated = 0;

    // Process each staking pool
    for (const poolAddress of allStakingPools) {
      try {
        // Get pool info
        const poolInfo = await rpcClient.readContract({
          address: stakingRewardsAddress,
          abi: STAKING_REWARDS_ABI,
          functionName: 'getPoolInfo',
          args: [poolAddress],
        });

        // Update staking_pools table
        await supabase.from('staking_pools').upsert({
          pool_address: poolAddress.toLowerCase(),
          lp_token: poolInfo.lpToken.toLowerCase(),
          reward_rate: poolInfo.rewardRate.toString(),
          total_staked: poolInfo.totalStaked.toString(),
          is_active: poolInfo.isActive,
          last_update_time: new Date(Number(poolInfo.lastUpdateTime) * 1000).toISOString(),
          reward_per_token_stored: poolInfo.rewardPerTokenStored.toString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'pool_address',
        });

        // Get existing positions that need updating (only active stakers or those with rewards)
        // This reduces RPC calls by only updating positions that matter
        const { data: existingPositions, error: positionsError } = await supabase
          .from('staking_positions')
          .select('user_address, staked_amount, accumulated_rewards, last_updated')
          .eq('pool_address', poolAddress.toLowerCase())
          .or('staked_amount.gt.0,accumulated_rewards.gt.0');

        if (positionsError) {
          console.warn(`  Warning: Could not fetch positions for pool ${poolAddress}:`, positionsError.message);
          continue;
        }

        // Build set of stakers to update
        const stakersToUpdate = new Set();
        
        // Add existing positions (active stakers)
        if (existingPositions) {
          for (const pos of existingPositions) {
            stakersToUpdate.add(pos.user_address.toLowerCase());
          }
        }

        // CRITICAL FIX: ALWAYS query chain events when pool has staked amount to catch ALL stakers
        // This ensures we find new stakers even if they're not in the database yet
        // Use conservative block range (1000 blocks) to avoid RPC rate limits
        if (poolInfo.totalStaked > 0n) {
          try {
            // Fetch events from last 1000 blocks (conservative, same as swap events max range)
            // This is enough to catch recent stakers without hitting RPC limits
            const currentBlock = await rpcClient.getBlockNumber();
            const fromBlock = currentBlock > BigInt(1000) ? currentBlock - BigInt(1000) : BigInt(0);
            
            const stakeEventAbi = parseAbiItem('event Staked(address indexed pool, address indexed user, uint256 amount)');
            const stakeLogs = await rpcClient.getLogs({
              address: stakingRewardsAddress,
              event: stakeEventAbi,
              args: { pool: poolAddress },
              fromBlock,
              toBlock: currentBlock,
            });
            
            if (stakeLogs.length > 0) {
              console.log(`  📡 Found ${stakeLogs.length} Staked events from chain for pool ${poolAddress}`);
            }
            
            // Add stakers from on-chain events (this will include new stakers not in DB yet)
            const stakersBefore = stakersToUpdate.size;
            for (const log of stakeLogs) {
              if (log.args && log.args.user) {
                const userAddr = log.args.user.toLowerCase();
                stakersToUpdate.add(userAddr);
                
                // Also store the event in database for future reference
                try {
                  const block = await rpcClient.getBlock({ blockNumber: log.blockNumber });
                  const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
                  await supabase.from('staking_events').upsert({
                    tx_hash: log.transactionHash,
                    event_type: 'stake',
                    user_address: userAddr,
                    pool_address: poolAddress.toLowerCase(),
                    amount: log.args.amount.toString(),
                    block_number: log.blockNumber.toString(),
                    timestamp: timestamp,
                  }, {
                    onConflict: 'tx_hash',
                  });
                } catch (e) {
                  console.warn(`  Warning: Could not store event ${log.transactionHash}:`, e.message);
                }
              }
            }
            
            const newStakersCount = stakersToUpdate.size - stakersBefore;
            if (newStakersCount > 0) {
              console.log(`  ✓ Added ${newStakersCount} new staker(s) from chain events (total: ${stakersToUpdate.size})`);
            }
          } catch (error) {
            console.warn(`  ⚠️ Could not fetch events from chain for pool ${poolAddress}:`, error.message);
            // Continue with existing positions if chain query fails
          }
        }

        console.log(`  Pool ${poolAddress}: Updating ${stakersToUpdate.size} stakers`);

        // Update accumulated rewards for each staker (with rate limiting)
        let poolStakersUpdated = 0;
        const BATCH_SIZE = 10; // Process 10 stakers at a time
        const stakersArray = Array.from(stakersToUpdate);
        
        for (let i = 0; i < stakersArray.length; i += BATCH_SIZE) {
          const batch = stakersArray.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel
          await Promise.all(batch.map(async (stakerAddress) => {
            try {
              // Get current staker info from contract (this has the latest accumulated rewards)
              // getStakerInfo returns a tuple: (stakedAmount, accumulatedRewards)
              const stakerInfo = await rpcClient.readContract({
                address: stakingRewardsAddress,
                abi: STAKING_REWARDS_ABI,
                functionName: 'getStakerInfo',
                args: [poolAddress, stakerAddress],
              });

              // viem returns tuples as arrays: [stakedAmount, accumulatedRewards]
              const stakedAmount = Array.isArray(stakerInfo) ? stakerInfo[0] : (stakerInfo.stakedAmount || 0n);
              const accumulatedRewards = Array.isArray(stakerInfo) ? stakerInfo[1] : (stakerInfo.accumulatedRewards || 0n);

              console.log(`  📊 Staker ${stakerAddress}: staked=${stakedAmount.toString()}, rewards=${accumulatedRewards.toString()}`);

              // Only update if user has staked amount > 0 OR accumulated rewards > 0
              // This prevents storing empty positions
              if (stakedAmount > 0n || accumulatedRewards > 0n) {
                const result = await supabase.from('staking_positions').upsert({
                  user_address: stakerAddress.toLowerCase(),
                  pool_address: poolAddress.toLowerCase(),
                  staked_amount: stakedAmount.toString(),
                  accumulated_rewards: accumulatedRewards.toString(),
                  last_updated: new Date().toISOString(),
                }, {
                  onConflict: 'user_address,pool_address',
                });
                
                if (result.error) {
                  console.warn(`  ⚠️ Error upserting staker ${stakerAddress}:`, result.error.message);
                } else {
                  console.log(`  ✓ Updated staker ${stakerAddress} in database`);
                  poolStakersUpdated++;
                }
              } else {
                console.log(`  ⚠️ Staker ${stakerAddress} has no stake or rewards, skipping`);
                // Remove position if user has nothing staked and no rewards
                await supabase
                  .from('staking_positions')
                  .delete()
                  .eq('user_address', stakerAddress.toLowerCase())
                  .eq('pool_address', poolAddress.toLowerCase());
              }
            } catch (error) {
              console.warn(`  ❌ Error updating staker ${stakerAddress}:`, error.message);
              if (error.stack) {
                console.warn(`  Stack:`, error.stack);
              }
            }
          }));
          
          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < stakersArray.length) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
        }

        totalStakersUpdated += poolStakersUpdated;
        console.log(`  ✓ Updated ${poolStakersUpdated} stakers for pool ${poolAddress}`);
      } catch (error) {
        console.warn(`  ❌ Error processing pool ${poolAddress}:`, error.message);
        if (error.stack) {
          console.warn(`  Stack:`, error.stack);
        }
      }
    }

    console.log(`✅ Updated accumulated DOA rewards for ${totalStakersUpdated} stakers across ${allStakingPools.length} pools`);
  } catch (error) {
    console.error('Exception indexing staking data:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

module.exports = {
  processStakingEvents,
  startContinuousStakingIndexer,
  indexStakingData,
  STAKING_REWARDS_ABI,
};
