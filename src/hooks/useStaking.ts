import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, type Address, isAddress } from 'viem';
import { DEX_CONFIG } from '../config/dex';
import { ERC20_ABI, STAKING_REWARDS_ABI, POOL_ABI } from '../config/abis';
import { useLPBalance, type TokenSymbol, TOKENS } from './useDEX';

// Staking contract address (will be set after deployment)
const STAKING_REWARDS_ADDRESS = DEX_CONFIG.STAKING_REWARDS_ADDRESS as Address | undefined;
const DOA_TOKEN_ADDRESS = DEX_CONFIG.DOA_TOKEN_ADDRESS as Address | undefined;

export interface PoolStakingInfo {
  poolAddress: Address;
  lpToken: Address;
  rewardRate: bigint; // DOA tokens per second
  totalStaked: bigint;
  isActive: boolean;
  apy?: number; // Calculated APY
}

export interface UserStakingInfo {
  stakedAmount: string;
  pendingRewards: string;
  apy?: number;
}

/**
 * Hook for interacting with the StakingRewards contract
 */
export function useStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Stake LP tokens
  const stake = useCallback(async (
    poolAddress: Address,
    amount: string
  ) => {
    if (!address || !isConnected || !STAKING_REWARDS_ADDRESS) {
      throw new Error('Wallet not connected or staking contract not deployed');
    }

    // Get pool info to find LP token address
    if (!publicClient) throw new Error('Public client not available');

    const poolInfo = await publicClient.readContract({
      address: STAKING_REWARDS_ADDRESS,
      abi: STAKING_REWARDS_ABI,
      functionName: 'getPoolInfo',
      args: [poolAddress],
    }) as any;

    if (!poolInfo || !poolInfo.isActive) {
      throw new Error('Pool is not active for staking');
    }

    const lpTokenAddress = poolInfo.lpToken as Address;
    const amountWei = parseUnits(amount, 18); // LP tokens use 18 decimals

    // Check allowance
    const allowance = await publicClient.readContract({
      address: lpTokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address, STAKING_REWARDS_ADDRESS],
    });

    if (allowance < amountWei) {
      throw new Error('NEED_APPROVE');
    }

    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'stake',
        args: [poolAddress, amountWei],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        throw new Error('User rejected transaction');
      }
      throw err;
    }
  }, [address, isConnected, writeContract, publicClient]);

  // Unstake LP tokens
  const unstake = useCallback(async (
    poolAddress: Address,
    amount: string
  ) => {
    if (!address || !isConnected || !STAKING_REWARDS_ADDRESS) {
      throw new Error('Wallet not connected or staking contract not deployed');
    }

    const amountWei = parseUnits(amount, 18);

    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'unstake',
        args: [poolAddress, amountWei],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        throw new Error('User rejected transaction');
      }
      throw err;
    }
  }, [address, isConnected, writeContract]);

  // Claim rewards from a specific pool
  const claimRewards = useCallback(async (poolAddress: Address) => {
    if (!address || !isConnected || !STAKING_REWARDS_ADDRESS) {
      throw new Error('Wallet not connected or staking contract not deployed');
    }

    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'claimRewards',
        args: [poolAddress],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        throw new Error('User rejected transaction');
      }
      throw err;
    }
  }, [address, isConnected, writeContract]);

  // Claim rewards from all pools
  const claimAllRewards = useCallback(async () => {
    if (!address || !isConnected || !STAKING_REWARDS_ADDRESS) {
      throw new Error('Wallet not connected or staking contract not deployed');
    }

    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'claimAllRewards',
        args: [],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        throw new Error('User rejected transaction');
      }
      throw err;
    }
  }, [address, isConnected, writeContract]);

  // Approve LP token for staking
  const approveLP = useCallback(async (poolAddress: Address) => {
    if (!address || !isConnected || !STAKING_REWARDS_ADDRESS || !publicClient) {
      throw new Error('Wallet not connected or staking contract not deployed');
    }

    // Get LP token address from pool info
    const poolInfo = await publicClient.readContract({
      address: STAKING_REWARDS_ADDRESS,
      abi: STAKING_REWARDS_ABI,
      functionName: 'getPoolInfo',
      args: [poolAddress],
    }) as any;

    if (!poolInfo) {
      throw new Error('Pool not found in staking contract');
    }

    const lpTokenAddress = poolInfo.lpToken as Address;
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    try {
      writeContract({
        address: lpTokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [STAKING_REWARDS_ADDRESS, maxApproval],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
        throw new Error('User rejected approval');
      }
      throw err;
    }
  }, [address, isConnected, writeContract, publicClient]);

  return {
    stake,
    unstake,
    claimRewards,
    claimAllRewards,
    approveLP,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to get staking info for a specific pool
 */
export function usePoolStakingInfo(poolAddress: Address | null) {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const { data: poolInfo } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'getPoolInfo',
    args: poolAddress ? [poolAddress] : undefined,
    query: {
      enabled: !!poolAddress && !!STAKING_REWARDS_ADDRESS && !!publicClient && isAddress(STAKING_REWARDS_ADDRESS),
      staleTime: 10000, // Cache for 10 seconds
      gcTime: 60000,
    },
  }) as { data: PoolStakingInfo | undefined };

  const { data: userStaked } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'getUserStaked',
    args: poolAddress && address ? [poolAddress, address] : undefined,
    query: {
      enabled: !!poolAddress && !!address && !!STAKING_REWARDS_ADDRESS && !!publicClient && isAddress(STAKING_REWARDS_ADDRESS),
      staleTime: 10000,
      gcTime: 60000,
    },
  });

  const { data: pendingRewards } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'getPendingRewards',
    args: poolAddress && address ? [poolAddress, address] : undefined,
    query: {
      enabled: !!poolAddress && !!address && !!STAKING_REWARDS_ADDRESS && !!publicClient && isAddress(STAKING_REWARDS_ADDRESS),
      staleTime: 30000, // Cache for 30 seconds to reduce RPC calls
      gcTime: 60000,
      // DO NOT use refetchInterval - it causes RPC rate limits
      // Data will be refreshed when user performs actions or manually refreshes
    },
  });

  // Calculate APY (simplified - assumes DOA token price = LP token price for now)
  const apy = useMemo(() => {
    if (!poolInfo || !poolInfo.isActive || poolInfo.totalStaked === 0n) {
      return undefined;
    }

    try {
      // Reward rate per second
      const rewardRatePerSecond = Number(formatUnits(poolInfo.rewardRate, 18));
      
      if (rewardRatePerSecond === 0) {
        return undefined;
      }
      
      // Calculate annual rewards
      const secondsPerYear = 31536000;
      const annualRewards = rewardRatePerSecond * secondsPerYear;

      // For APY calculation, we'd need token prices
      // Simplified: assume 1 DOA = 1 LP token value
      // In production, you'd fetch actual prices from an oracle or DEX
      const totalStakedNum = Number(formatUnits(poolInfo.totalStaked, 18));
      
      if (totalStakedNum === 0 || !isFinite(totalStakedNum)) {
        return undefined;
      }

      // APY = (Annual Rewards / Total Staked) * 100
      const apr = (annualRewards / totalStakedNum) * 100;
      
      // Cap APR at 10000% to prevent infinity/very large numbers
      if (apr > 10000 || !isFinite(apr)) {
        return undefined;
      }
      
      // Convert to APY with daily compounding
      const apy = (Math.pow(1 + (apr / 100) / 365, 365) - 1) * 100;
      
      // Cap final APY at 10000% and check for infinity
      if (apy > 10000 || !isFinite(apy)) {
        return undefined;
      }

      return apy;
    } catch {
      return undefined;
    }
  }, [poolInfo]);

  return {
    poolInfo: poolInfo ? {
      ...poolInfo,
      apy,
    } : undefined,
    userStaked: userStaked ? formatUnits(userStaked, 18) : '0',
    pendingRewards: pendingRewards ? formatUnits(pendingRewards, 18) : '0',
    apy,
  };
}

/**
 * Hook to get all staking pools
 */
export function useAllStakingPools() {
  const publicClient = usePublicClient();

  const { data: allPools } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'getAllPools',
    query: {
      enabled: !!STAKING_REWARDS_ADDRESS && !!publicClient && isAddress(STAKING_REWARDS_ADDRESS),
      staleTime: 60000, // Cache for 1 minute
      gcTime: 300000,
    },
  }) as { data: Address[] | undefined };

  return allPools || [];
}

/**
 * Hook to check if LP token is approved for staking
 */
export function useLPApprovalForStaking(poolAddress: Address | null) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // Get LP token address from pool info
  const { data: poolInfo } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'getPoolInfo',
    args: poolAddress ? [poolAddress] : undefined,
    query: {
      enabled: !!poolAddress && !!STAKING_REWARDS_ADDRESS && !!publicClient && isAddress(STAKING_REWARDS_ADDRESS),
    },
  }) as { data: PoolStakingInfo | undefined };

  const lpTokenAddress = poolInfo?.lpToken as Address | undefined;

  const { data: allowance } = useReadContract({
    address: lpTokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && STAKING_REWARDS_ADDRESS && lpTokenAddress
      ? [address, STAKING_REWARDS_ADDRESS]
      : undefined,
    query: {
      enabled: !!address && !!isConnected && !!lpTokenAddress && !!STAKING_REWARDS_ADDRESS,
      staleTime: 30000,
    },
  });

  return {
    isApproved: allowance ? allowance > 0n : false,
    allowance: allowance || 0n,
    lpTokenAddress,
  };
}
