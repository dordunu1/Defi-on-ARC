import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sprout, 
  TrendingUp, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  X,
  Coins,
  ArrowUpDown,
  Zap,
  HelpCircle,
  Grid,
  LayoutList,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  Plus,
  Minus
} from 'lucide-react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, type Address, isAddress } from 'viem';
import { 
  useDEX, 
  useTokenBalance, 
  usePoolReserves, 
  useLPBalance, 
  TOKENS, 
  type TokenSymbol,
  usePoolAddress
} from '../hooks/useDEX';
import { 
  useStaking, 
  usePoolStakingInfo, 
  useAllStakingPools,
  useLPApprovalForStaking
} from '../hooks/useStaking';
import { ERC20_ABI, POOL_ABI, STAKING_REWARDS_ABI } from '../config/abis';
import { DEX_CONFIG } from '../config/dex';
import TokenLogo from './TokenLogo';

const AVAILABLE_TOKENS: TokenSymbol[] = ['SRAC', 'RACS', 'SACS', 'USDC', 'KITTY', 'DOGG', 'EURC'];

interface StakingPoolInfo {
  poolAddress: Address;
  tokenA: Address;
  tokenB: Address;
  tokenASymbol: string;
  tokenBSymbol: string;
  // From Supabase staking_pools
  rewardRate: string;
  totalStaked: string;
  isActive: boolean;
  // From Supabase staking_positions (user-specific)
  userStaked?: string;
  accumulatedRewards?: string;
  // From pools table (for token symbols)
  lpToken?: string;
}

// Skeleton loader component - List view
function PoolSkeletonList() {
  return (
    <motion.div
        className="bg-white/60 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 border border-white/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex -space-x-2">
            <div className="w-12 h-12 rounded-full bg-gray-200/60 animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-gray-200/60 animate-pulse" />
          </div>
          <div>
            <div className="h-5 w-32 bg-gray-200/60 rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-gray-200/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full sm:w-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-3 w-16 bg-gray-200/60 rounded animate-pulse mb-2" />
              <div className="h-4 w-20 bg-gray-200/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Skeleton loader component - Grid view
function PoolSkeletonGrid() {
  return (
    <motion.div
      className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-gray-200/60 animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-gray-200/60 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="h-4 w-24 bg-gray-200/60 rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-gray-200/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-3 w-12 bg-gray-200/60 rounded animate-pulse mb-1" />
              <div className="h-4 w-16 bg-gray-200/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-10 w-full bg-gray-200/60 rounded-xl animate-pulse" />
      </div>
    </motion.div>
  );
}

export default function Farming() {
  const { isConnected, address, chainId } = useAccount();
  const [tokenA, setTokenA] = useState<TokenSymbol>('SRAC');
  const [tokenB, setTokenB] = useState<TokenSymbol>('USDC');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake' | 'pools'>('pools');
  const [showTokenSelector, setShowTokenSelector] = useState<'A' | 'B' | null>(null);
  const [selectedPool, setSelectedPool] = useState<Address | null>(null);
  const [stakingPools, setStakingPools] = useState<StakingPoolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const { stake, unstake, claimRewards, claimAllRewards, approveLP, isPending, isConfirming, isSuccess, error, hash } = useStaking();
  const [unstakeHash, setUnstakeHash] = useState<string | null>(null);
  const [actionStep, setActionStep] = useState<'none' | 'approving' | 'staking' | 'unstaking' | 'claiming'>('none');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [stakeHash, setStakeHash] = useState<string | null>(null);
  const [pendingStakeAfterApproval, setPendingStakeAfterApproval] = useState<{ poolAddress: Address; amount: string } | null>(null);
  // Track which approval just completed to prevent duplicate triggers (same pattern as Swap.tsx)
  const [completedApprovalStep, setCompletedApprovalStep] = useState<'none' | 'approving'>('none');
  // Stable step completion tracking to prevent flickering (same as Swap.tsx)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  // Progress modal state (same as Swap.tsx and AddLiquidityModal.tsx)
  const [showProgressModal, setShowProgressModal] = useState(false);
  // Track when staking transaction actually started (to prevent premature success)
  const [stakingTransactionStarted, setStakingTransactionStarted] = useState(false);
  const publicClient = usePublicClient();

  // Use selectedPool if available, otherwise use tokenA/tokenB to get pool address
  const poolAddressFromTokens = usePoolAddress(tokenA, tokenB);
  const poolAddress = selectedPool || poolAddressFromTokens;
  const stakingInfo = usePoolStakingInfo(poolAddress);
  
  // Calculate APY for the selected pool (for stake section)
  const calculateAPY = useCallback((pool: StakingPoolInfo) => {
    try {
      const rewardRatePerSecond = parseFloat(formatUnits(BigInt(pool.rewardRate || '0'), 18));
      const totalStakedNum = parseFloat(formatUnits(BigInt(pool.totalStaked || '0'), 18));
      const userStakedNum = parseFloat(formatUnits(BigInt(pool.userStaked || '0'), 18));
      
      // If user has staked but totalStaked is 0, use userStaked as minimum
      // This handles the case where indexer hasn't updated totalStaked yet
      const effectiveTotalStaked = totalStakedNum > 0 ? totalStakedNum : (userStakedNum > 0 ? userStakedNum : 0);
      
      // Check isActive - handle boolean, string, or null values from Supabase
      const isPoolActive = pool.isActive === true || String(pool.isActive).toLowerCase() === 'true';
      
      if (!isPoolActive || effectiveTotalStaked === 0 || rewardRatePerSecond === 0) {
        return undefined;
      }
      
      // Calculate annual rewards
      const secondsPerYear = 31536000;
      const annualRewards = rewardRatePerSecond * secondsPerYear;
      
      // APY = (Annual Rewards / Total Staked) * 100
      const apr = (annualRewards / effectiveTotalStaked) * 100;
      
      // Check for invalid values
      if (!isFinite(apr) || apr < 0 || !isFinite(annualRewards) || !isFinite(effectiveTotalStaked)) {
        return undefined;
      }
      
      // Convert to APY with daily compounding
      // For very high APR, Math.pow might return Infinity, so we need to handle it
      let apy;
      const dailyRate = (apr / 100) / 365;
      
      // If APR is extremely high (>100000%), Math.pow will return Infinity
      // In that case, use a simplified calculation or show the APR directly
      if (apr > 100000) {
        // For extremely high APR, APY ≈ APR (compounding effect is negligible)
        apy = apr;
      } else {
        apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;
      }
      
      // Check for invalid APY values
      if (!isFinite(apy) || apy < 0) {
        return undefined;
      }
      
      return apy;
    } catch {
      return undefined;
    }
  }, []);
  const lpBalanceFromTokens = useLPBalance(tokenA, tokenB);
  const lpApproval = useLPApprovalForStaking(poolAddress);

  const isArcTestnet = chainId === 5042002;

  // Supabase configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Format reward rate helper (rewardRate from Supabase is stored as string in wei format)
  const formatRewardRate = useCallback((rateStr: string) => {
    try {
      const rateWei = BigInt(rateStr || '0');
      const rate = parseFloat(formatUnits(rateWei, 18));
      // Use toFixed(2) to show 0.005 correctly (toFixed(1) would round 0.005 to 0.0)
      return rate.toFixed(3);
    } catch {
      return '0.000';
    }
  }, []);

  // Fetch staking pools from Supabase
  const fetchStakingPools = useCallback(async (showLoading = true) => {
    if (!isArcTestnet || !supabaseUrl || !supabaseKey || !DEX_CONFIG.STAKING_REWARDS_ADDRESS) {
      setStakingPools([]);
      setIsLoading(false);
      return;
    }

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      // Fetch staking pools from Supabase
      const poolsResponse = await fetch(
        `${supabaseUrl}/rest/v1/staking_pools?select=*&is_active=eq.true&order=total_staked.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );

      if (!poolsResponse.ok) {
        setIsLoading(false);
        return;
      }

      const poolsData = await poolsResponse.json();

      // Fetch user positions if connected
      let userPositionsMap = new Map<string, { staked_amount: string; accumulated_rewards: string }>();
      if (address && isConnected) {
        const positionsResponse = await fetch(
          `${supabaseUrl}/rest/v1/staking_positions?select=pool_address,staked_amount,accumulated_rewards&user_address=eq.${address.toLowerCase()}`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        if (positionsResponse.ok) {
          const positionsData = await positionsResponse.json();
          positionsData.forEach((pos: any) => {
            userPositionsMap.set(pos.pool_address.toLowerCase(), {
              staked_amount: pos.staked_amount || '0',
              accumulated_rewards: pos.accumulated_rewards || '0',
            });
          });
        }
      }

      // Fetch pool token info from pools table
      const poolsInfoResponse = await fetch(
        `${supabaseUrl}/rest/v1/pools?select=pool_address,token_a,token_b,token_a_symbol,token_b_symbol`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );

      const poolsInfoMap = new Map<string, { tokenA: string; tokenB: string; tokenASymbol: string; tokenBSymbol: string }>();
      if (poolsInfoResponse.ok) {
        const poolsInfoData = await poolsInfoResponse.json();
        poolsInfoData.forEach((pool: any) => {
          poolsInfoMap.set(pool.pool_address.toLowerCase(), {
            tokenA: pool.token_a,
            tokenB: pool.token_b,
            tokenASymbol: pool.token_a_symbol || 'Unknown',
            tokenBSymbol: pool.token_b_symbol || 'Unknown',
          });
        });
      }

      // Combine data
      const stakingPoolsList: StakingPoolInfo[] = poolsData.map((pool: any) => {
        const poolAddr = pool.pool_address.toLowerCase();
        const poolInfo = poolsInfoMap.get(poolAddr);
        const userPos = userPositionsMap.get(poolAddr);

        return {
          poolAddress: pool.pool_address as Address,
          tokenA: (poolInfo?.tokenA || '0x0') as Address,
          tokenB: (poolInfo?.tokenB || '0x0') as Address,
          tokenASymbol: poolInfo?.tokenASymbol || 'Unknown',
          tokenBSymbol: poolInfo?.tokenBSymbol || 'Unknown',
          rewardRate: pool.reward_rate || '0',
          totalStaked: pool.total_staked || '0',
          isActive: pool.is_active || false,
          userStaked: userPos?.staked_amount || '0',
          accumulatedRewards: userPos?.accumulated_rewards || '0',
          lpToken: pool.lp_token,
        };
      });

      setStakingPools(stakingPoolsList);
      if (showLoading) {
        setIsLoading(false);
      }
    } catch (error) {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [isArcTestnet, supabaseUrl, supabaseKey, address, isConnected]);

  // Initial fetch
  useEffect(() => {
    fetchStakingPools(true);
  }, [fetchStakingPools]);

  // Auto-refresh every 30 seconds (background, no loading state)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStakingPools(false); // Don't show loading state for background refresh
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStakingPools]);

  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    setIsRefreshing(true);
    try {
      await fetchStakingPools(true);
    } catch (error) {
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Filter pools by search query
  const filteredPools = useMemo(() => {
    if (!searchQuery) return stakingPools;

    return stakingPools.filter((pool) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        pool.tokenASymbol.toLowerCase().includes(searchLower) ||
        pool.tokenBSymbol.toLowerCase().includes(searchLower) ||
        `${pool.tokenASymbol}/${pool.tokenBSymbol}`.toLowerCase().includes(searchLower) ||
        pool.poolAddress.toLowerCase().includes(searchLower)
      );
    });
  }, [stakingPools, searchQuery]);

  // Format error message
  const formatErrorMessage = (err: any): string => {
    if (!err) return 'Unknown error occurred';
    
    // Check for error code first (MetaMask uses code 4001 for user rejection)
    if (err.code === 4001 || err.code === '4001') {
      return 'Transaction was rejected.';
    }
    
    const errorStr = err.message || err.toString() || '';
    const errorLower = errorStr.toLowerCase();
    
    // Check for user rejection in various formats
    if (errorLower.includes('user rejected') || 
        errorLower.includes('user denied') || 
        errorLower.includes('user cancelled') ||
        errorLower.includes('denied transaction signature') ||
        errorLower.includes('rejected') ||
        errorLower.includes('denied') ||
        errorLower.includes('cancelled') ||
        errorLower.includes('action rejected') ||
        errorStr.includes('4001') || // MetaMask user rejection code
        errorStr.includes('ACTION_REJECTED')) {
      return 'Transaction was rejected.';
    }
    if (errorStr.includes('NEED_APPROVE')) {
      return 'Please approve LP token first.';
    }
    if (errorStr.includes('Insufficient')) {
      return 'Insufficient balance.';
    }
    return errorStr || 'An error occurred.';
  };

  // Handle stake
  const handleStake = async () => {
    if (!poolAddress || !stakeAmount || parseFloat(stakeAmount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    // Get the correct LP balance for the selected pool
    const currentLPBalance = selectedPool && userLPBalances.length > 0
      ? userLPBalances.find(lp => lp.poolAddress.toLowerCase() === selectedPool.toLowerCase())?.lpBalance || '0'
      : lpBalance;

    // Use epsilon for floating point comparison to avoid precision issues
    const balanceNum = parseFloat(currentLPBalance || '0');
    const amountNum = parseFloat(stakeAmount);
    // Use a larger epsilon (0.00001) to account for rounding/truncation issues
    // This ensures we catch cases where the amount exceeds balance due to precision errors
    if (amountNum > balanceNum + 0.00001) {
      setErrorMessage('Insufficient LP token balance');
      return;
    }

    // Clear all messages and set initial state
    setErrorMessage(null);
    setSuccessMessage(null);
    setApprovalHash(null);
    setStakeHash(null);

    try {
      // Step 1: Approve if needed
      if (!lpApproval.isApproved) {
        setActionStep('approving');
        setErrorMessage(null); // Clear any previous errors
        setSuccessMessage(null); // Clear any previous success messages
        setPendingStakeAfterApproval({ poolAddress, amount: stakeAmount });
        setShowProgressModal(true); // Open progress modal (same as Swap.tsx)
        setCompletedSteps(new Set()); // Reset completed steps
        
        try {
          await approveLP(poolAddress);
          
          // Wait for transaction hash
          let hashWaitCount = 0;
          let currentHash = hash;
          while (!currentHash && hashWaitCount < 30) {
            await new Promise(resolve => setTimeout(resolve, 200));
            currentHash = hash;
            hashWaitCount++;
          }
          
          if (currentHash) {
            setApprovalHash(currentHash);
          }
          
          // The useEffect above will handle proceeding to staking after approval completes
          // Progress modal will stay open and transition to staking step
          return;
        } catch (approveErr: any) {
          const errorMsg = formatErrorMessage(approveErr);
          // Show rejection message if user rejected
          if (errorMsg.toLowerCase().includes('rejected') || errorMsg.toLowerCase().includes('cancelled') || errorMsg.toLowerCase().includes('denied')) {
            setErrorMessage('Transaction was rejected. Please try again when ready.');
            setTimeout(() => setErrorMessage(null), 5000);
          } else {
            setErrorMessage(errorMsg);
          }
          setActionStep('none');
          setApprovalHash(null);
          setPendingStakeAfterApproval(null);
          setShowProgressModal(false); // Close progress modal on error
          setCompletedSteps(new Set()); // Reset completed steps
          return; // Stop here if approval failed
        }
      }

      // Step 2: Stake directly if already approved
      setActionStep('staking');
      setErrorMessage(null); // Clear any errors before staking
      setSuccessMessage(null); // Clear any previous success messages
      setShowProgressModal(true); // Open progress modal (same as Swap.tsx)
      setCompletedSteps(new Set(['approval'])); // Mark approval as completed since already approved
      setStakingTransactionStarted(false); // Reset - will be set when stake hash appears
      
      try {
        await stake(poolAddress, stakeAmount);
        
        // Wait for stake transaction hash
        let stakeHashWaitCount = 0;
        let currentStakeHash = hash;
        while ((!currentStakeHash || currentStakeHash === approvalHash) && stakeHashWaitCount < 30) {
          await new Promise(resolve => setTimeout(resolve, 200));
          currentStakeHash = hash;
          stakeHashWaitCount++;
        }
        
        if (currentStakeHash && currentStakeHash !== approvalHash) {
          setStakeHash(currentStakeHash);
          setStakingTransactionStarted(true); // Mark that staking transaction has started
        }
        
        // DO NOT set success message here - wait for transaction confirmation
        // The useEffect will handle success when isSuccess becomes true and transaction is confirmed
        // Keep actionStep as 'staking' and let the useEffect detect success when confirmed
      } catch (stakeErr: any) {
        const errorMsg = formatErrorMessage(stakeErr);
        // Show rejection message if user rejected
        if (errorMsg.includes('cancelled') || errorMsg.includes('rejected') || errorMsg.includes('denied')) {
          setErrorMessage('Transaction was rejected. Please try again when ready.');
          setTimeout(() => setErrorMessage(null), 5000);
        } else if (!errorMsg.includes('Please approve')) {
          setErrorMessage(errorMsg);
        }
        setActionStep('none');
      }
    } catch (err: any) {
      const errorMsg = formatErrorMessage(err);
      // Show rejection message if user rejected
      if (errorMsg.includes('cancelled') || errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        setErrorMessage('Transaction was rejected. Please try again when ready.');
        setTimeout(() => setErrorMessage(null), 5000);
      } else {
        setErrorMessage(errorMsg);
      }
      setActionStep('none');
      setStakeHash(null);
    }
  };

  // Handle unstake
  const handleUnstake = async () => {
    if (!poolAddress || !unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    const userStaked = stakingPools.find(p => p.poolAddress.toLowerCase() === poolAddress.toLowerCase())?.userStaked || '0';
    const userStakedFormatted = parseFloat(formatUnits(BigInt(userStaked), 18));
    if (parseFloat(unstakeAmount) > userStakedFormatted) {
      setErrorMessage('Insufficient staked amount');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setUnstakeHash(null);
    setActionStep('unstaking');

    try {
      // unstake function expects human-readable amount (it converts to wei internally)
      // This just submits the transaction - doesn't wait for confirmation
      await unstake(poolAddress, unstakeAmount);
      
      // Wait for transaction hash
      let hashWaitCount = 0;
      let currentHash = hash;
      while (!currentHash && hashWaitCount < 30) {
        await new Promise(resolve => setTimeout(resolve, 200));
        currentHash = hash;
        hashWaitCount++;
      }
      
      if (currentHash) {
        setUnstakeHash(currentHash);
      }
      
      // DO NOT set success message here - wait for transaction confirmation
      // The useEffect will handle success when isSuccess becomes true
    } catch (err: any) {
      const errorMsg = formatErrorMessage(err);
      // Show rejection message if user rejected
      if (errorMsg.includes('cancelled') || errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        setErrorMessage('Transaction was rejected. Please try again when ready.');
        setTimeout(() => setErrorMessage(null), 5000);
      } else {
        setErrorMessage(errorMsg);
      }
      setActionStep('none');
      setUnstakeHash(null);
    }
  };

  // Handle claim rewards (disabled for now - future claim)
  const handleClaimRewards = async (poolAddr?: Address) => {
    setErrorMessage('Claiming is currently disabled. Rewards will be distributed via future claim.');
    return;
  };

  // Track when approval completes and auto-proceed to staking
  // EXACT same pattern as Swap.tsx (line 475-522)
  useEffect(() => {
    if (isSuccess && actionStep === 'approving' && completedApprovalStep !== 'approving' && address && publicClient && pendingStakeAfterApproval) {
      const proceedToStake = async () => {
        try {
          // Mark approval as completed to prevent re-triggering (same as Swap.tsx)
          setCompletedApprovalStep('approving');
          setCompletedSteps(prev => new Set(prev).add('approval'));
          
          // Wait a moment for state to update (same as Swap.tsx)
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check fresh allowance on-chain (same as Swap.tsx pattern)
          if (!publicClient || !pendingStakeAfterApproval.poolAddress) {
            throw new Error('Public client not available');
          }

          // Get pool info to find LP token address
          const poolInfo = await publicClient.readContract({
            address: DEX_CONFIG.STAKING_REWARDS_ADDRESS as Address,
            abi: STAKING_REWARDS_ABI,
            functionName: 'getPoolInfo',
            args: [pendingStakeAfterApproval.poolAddress],
          }) as any;

          if (!poolInfo || !poolInfo.isActive) {
            throw new Error('Pool is not active for staking');
          }

          const lpTokenAddress = poolInfo.lpToken as Address;
          const amountWei = parseUnits(pendingStakeAfterApproval.amount, 18);

          // Check fresh allowance (same as Swap.tsx)
          const freshAllowance = await publicClient.readContract({
            address: lpTokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, DEX_CONFIG.STAKING_REWARDS_ADDRESS as Address],
          });

          if (freshAllowance >= amountWei) {
            // Approval confirmed, proceed to staking (same as Swap.tsx proceeds to swap)
            // CRITICAL: Keep progress modal open - just change step
            setActionStep('staking');
            setErrorMessage(null);
            setSuccessMessage(null); // Clear any messages
            setCompletedApprovalStep('none'); // Reset for next time
            // Keep showProgressModal true - don't close it
            
            // Proceed to staking - this will keep the flow going
            await stake(pendingStakeAfterApproval.poolAddress, pendingStakeAfterApproval.amount);
            
            // Wait for stake transaction hash (new hash different from approval)
            let stakeHashWaitCount = 0;
            let currentStakeHash = hash;
            while ((!currentStakeHash || currentStakeHash === approvalHash) && stakeHashWaitCount < 30) {
              await new Promise(resolve => setTimeout(resolve, 200));
              currentStakeHash = hash;
              stakeHashWaitCount++;
            }
            
            if (currentStakeHash && currentStakeHash !== approvalHash) {
              setStakeHash(currentStakeHash);
            }
          } else {
            throw new Error('Approval incomplete');
          }
        } catch (err: any) {
          const errorMsg = formatErrorMessage(err);
          setErrorMessage(errorMsg);
          setActionStep('none');
          setPendingStakeAfterApproval(null);
          setCompletedApprovalStep('none');
          setShowProgressModal(false); // Close progress modal on error
          setCompletedSteps(new Set()); // Reset completed steps
        }
      };

      proceedToStake();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, actionStep, completedApprovalStep, address, publicClient, pendingStakeAfterApproval, stake, hash, approvalHash]);

  // Reset success/error messages - only handle stake/unstake success here
  // This useEffect will catch success even if RPC lag delayed the initial detection
  useEffect(() => {
    // CRITICAL: Only handle success for staking/unstaking, NEVER for approval
    // Approval success is handled in the auto-proceed useEffect above
    // Must check BOTH actionStep AND hash to ensure we're not showing success for approval
    
    // First, explicitly ignore approval success - NEVER show success for approval
    if (isSuccess && (actionStep === 'approving' || hash === approvalHash)) {
      // Approval succeeded - do NOT show success message
      // The auto-proceed useEffect will handle moving to staking
      // DO NOT set success message here - approval is not the final step
      return;
    }
    
    // Only proceed if we're in staking or unstaking state AND transaction is confirmed
    // CRITICAL: Must have stakeHash set AND hash must match stakeHash (not approvalHash)
    // CRITICAL: Must have stakingTransactionStarted to ensure we actually started staking
    if (isSuccess && !isPending && !isConfirming && (actionStep === 'staking' || actionStep === 'unstaking')) {
      if (actionStep === 'staking') {
        // CRITICAL: Only show success if:
        // 1. We have a stakeHash (meaning staking transaction was submitted)
        // 2. Staking transaction actually started (stakingTransactionStarted is true)
        // 3. Current hash matches stakeHash
        // 4. Hash is NOT approvalHash (double check)
        const hasStakeHash = stakeHash !== null;
        const hashMatchesStake = hasStakeHash && hash === stakeHash;
        const isNotApprovalHash = hash !== approvalHash;
        const stakingStarted = stakingTransactionStarted;
        
        if (hasStakeHash && hashMatchesStake && isNotApprovalHash && stakingStarted) {
          // Add 5 second delay before showing success (as requested by user)
          setTimeout(() => {
            // Double-check that we're still in staking state and hash still matches
            if (actionStep === 'staking' && hash === stakeHash && hash !== approvalHash && stakingTransactionStarted) {
              setStakeAmount('');
              setSuccessMessage('Successfully staked LP tokens!');
              setActionStep('none');
              setPendingStakeAfterApproval(null);
              setStakeHash(null);
              setApprovalHash(null); // Clear approval hash
              setStakingTransactionStarted(false); // Reset
              setShowProgressModal(false); // Close progress modal after success
              setCompletedSteps(new Set()); // Reset completed steps
              fetchStakingPools(false); // Refresh data (background)
              // Refresh LP balances after staking (only if on stake tab)
              if (activeTab === 'stake') {
                // Trigger LP balance refresh by changing a dependency
                // This will cause the useEffect to re-run
              }
              setTimeout(() => setSuccessMessage(null), 5000);
            }
          }, 5000); // 5 second delay as requested
        }
      } else if (actionStep === 'unstaking') {
        // Only show success if hash matches unstakeHash AND is NOT approvalHash
        const isUnstakingHash = unstakeHash ? (hash === unstakeHash && hash !== approvalHash) : (hash && hash !== approvalHash);
        
        if (isUnstakingHash) {
          // Add 5 second delay before showing success (as requested)
          setTimeout(() => {
            setUnstakeAmount('');
            setSuccessMessage('Successfully unstaked LP tokens!');
            setActionStep('none');
            setUnstakeHash(null);
            fetchStakingPools(false); // Refresh data (background)
            setTimeout(() => setSuccessMessage(null), 5000);
          }, 5000); // 5 second delay as requested
        }
      }
    }
    if (error) {
      const errorMsg = formatErrorMessage(error);
      // Show rejection message if user rejected (regardless of actionStep)
      if (errorMsg.includes('rejected') || errorMsg.includes('denied') || errorMsg.includes('cancelled')) {
        setErrorMessage('Transaction was rejected. Please try again when ready.');
        setTimeout(() => setErrorMessage(null), 5000);
        setActionStep('none');
        return;
      }
      // Don't show error messages during approval/staking process for other errors
      // The handleStake/handleUnstake functions will handle errors appropriately
      if (actionStep === 'none') {
        // Don't show "Please approve" error - it's handled in the button logic
        if (!errorMsg.includes('Please approve')) {
          setErrorMessage(errorMsg);
        }
      } else {
        // Clear error messages during approval/staking to prevent confusion
        setErrorMessage(null);
      }
    }
  }, [isSuccess, error, actionStep, hash, approvalHash, stakeHash, unstakeHash, isPending, isConfirming, successMessage]);

  if (!DEX_CONFIG.STAKING_REWARDS_ADDRESS) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Staking Not Available</h2>
          <p className="text-gray-600 mb-4">
            The staking contract has not been deployed yet. Please deploy the StakingRewards contract first.
          </p>
        </div>
      </div>
    );
  }

  // Get user's LP balances from all staking pools (check LP balance from contract)
  const [userLPBalances, setUserLPBalances] = useState<Array<{
    poolAddress: Address;
    tokenASymbol: string;
    tokenBSymbol: string;
    lpBalance: string;
  }>>([]);

  // Fetch user LP balances ONLY when stake tab is active (to avoid RPC rate limits)
  // DO NOT poll continuously - only fetch on-demand
  useEffect(() => {
    // Only fetch if stake tab is active and user is connected
    if (!isConnected || !address || !publicClient || !isArcTestnet || stakingPools.length === 0 || activeTab !== 'stake') {
      if (activeTab !== 'stake') {
        // Clear balances when not on stake tab to save memory
        setUserLPBalances([]);
      }
      return;
    }

    const fetchUserLPBalances = async () => {
      try {
        // Check LP balance for each staking pool (only when stake tab is active)
        const balances = await Promise.all(
          stakingPools.map(async (pool) => {
            try {
              const lpBalance = await publicClient.readContract({
                address: pool.poolAddress,
                abi: POOL_ABI,
                functionName: 'balanceOf',
                args: [address],
              });
              
              const balanceStr = formatUnits(lpBalance as bigint, 18);
              if (parseFloat(balanceStr) > 0) {
                return {
                  poolAddress: pool.poolAddress,
                  tokenASymbol: pool.tokenASymbol,
                  tokenBSymbol: pool.tokenBSymbol,
                  lpBalance: balanceStr,
                };
              }
            } catch (error) {
              // Silently fail for individual pools to avoid spamming errors
            }
            return null;
          })
        );

        setUserLPBalances(balances.filter((b): b is NonNullable<typeof b> => b !== null));
      } catch (error) {
        // Silently fail to avoid spamming errors
      }
    };

    // Fetch immediately when stake tab becomes active
    fetchUserLPBalances();
    
    // DO NOT use setInterval - it causes RPC rate limits!
    // LP balances will be refreshed when:
    // 1. User switches to stake tab (this useEffect)
    // 2. After successful stake/unstake (fetchStakingPools will trigger re-fetch via dependency change)
    // 3. Manual refresh button
  }, [isConnected, address, publicClient, isArcTestnet, stakingPools, activeTab]);

  // Get LP balance from selected pool if available (must be after userLPBalances is declared)
  const lpBalance = useMemo(() => {
    if (selectedPool && userLPBalances.length > 0) {
      const selectedLP = userLPBalances.find(lp => 
        lp.poolAddress.toLowerCase() === selectedPool.toLowerCase()
      );
      return selectedLP?.lpBalance || '0';
    }
    return lpBalanceFromTokens;
  }, [selectedPool, userLPBalances, lpBalanceFromTokens]);

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 md:px-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/30 relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(0, 0, 0, 0.05),
            0 10px 30px rgba(0, 0, 0, 0.1),
            0 4px 8px rgba(0, 0, 0, 0.05)
          `
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sprout className="w-6 h-6 md:w-7 md:h-7 text-orange-600" />
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">LP Farming</h2>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              Stake your LP tokens to earn DOA rewards
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all flex items-center gap-2 ${
                isRefreshing
                  ? 'bg-gray-200/90 backdrop-blur-sm text-gray-500 cursor-not-allowed border border-gray-300/50'
                  : 'bg-white/90 backdrop-blur-lg text-gray-700 hover:bg-white border border-gray-200 shadow-sm hover:shadow-md'
              }`}
              style={{
                boxShadow: isRefreshing ? 'none' : `
                  inset 0 1px 0 rgba(255, 255, 255, 0.9),
                  0 2px 4px rgba(0, 0, 0, 0.05),
                  0 1px 2px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div 
              className="flex items-center gap-1 bg-white/90 backdrop-blur-lg border border-gray-200 rounded-xl p-1 shadow-sm"
              style={{
                boxShadow: `
                  inset 0 1px 0 rgba(255, 255, 255, 0.9),
                  0 2px 4px rgba(0, 0, 0, 0.05),
                  0 1px 2px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100/80'
                }`}
                aria-label="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100/80'
                }`}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 bg-white/60 backdrop-blur-lg rounded-xl sm:rounded-2xl p-1 border border-white/30 relative z-10">
          <button
            onClick={() => setActiveTab('pools')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all relative overflow-hidden ${
              activeTab === 'pools'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {activeTab === 'pools' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg sm:rounded-xl"
                layoutId="activeFarmingTab"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{
                  boxShadow: `
                    inset 0 2px 4px rgba(255, 255, 255, 0.3),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(251, 146, 60, 0.4),
                    0 2px 4px rgba(0, 0, 0, 0.1)
                  `,
                }}
              />
            )}
            <Coins className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2 relative z-10" />
            <span className="relative z-10 hidden sm:inline">All Pools</span>
            <span className="relative z-10 sm:hidden">Pools</span>
          </button>
          <button
            onClick={() => setActiveTab('stake')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all relative overflow-hidden ${
              activeTab === 'stake'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {activeTab === 'stake' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg sm:rounded-xl"
                layoutId="activeFarmingTab"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{
                  boxShadow: `
                    inset 0 2px 4px rgba(255, 255, 255, 0.3),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(251, 146, 60, 0.4),
                    0 2px 4px rgba(0, 0, 0, 0.1)
                  `,
                }}
              />
            )}
            <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2 relative z-10" />
            <span className="relative z-10">Stake</span>
          </button>
          <button
            onClick={() => setActiveTab('unstake')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all relative overflow-hidden ${
              activeTab === 'unstake'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {activeTab === 'unstake' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg sm:rounded-xl"
                layoutId="activeFarmingTab"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={{
                  boxShadow: `
                    inset 0 2px 4px rgba(255, 255, 255, 0.3),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(251, 146, 60, 0.4),
                    0 2px 4px rgba(0, 0, 0, 0.1)
                  `,
                }}
              />
            )}
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2 relative z-10" />
            <span className="relative z-10">Unstake</span>
          </button>
        </div>

        {/* Search Bar */}
        {activeTab === 'pools' && (
          <div className="mb-4 sm:mb-6 relative z-10">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pools..."
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 bg-white/90 backdrop-blur-lg rounded-lg sm:rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base text-gray-900 placeholder-gray-400 shadow-sm"
                style={{
                  boxShadow: `
                    inset 0 1px 0 rgba(255, 255, 255, 0.9),
                    0 2px 4px rgba(0, 0, 0, 0.05),
                    0 1px 2px rgba(0, 0, 0, 0.1)
                  `,
                }}
              />
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-3 sm:mb-4 bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base flex items-center gap-2 relative z-10"
            >
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="break-words">{successMessage}</span>
            </motion.div>
          )}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-3 sm:mb-4 bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base flex items-center gap-2 relative z-10"
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* All Pools Tab */}
        {activeTab === 'pools' && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 relative z-10' : 'space-y-2 sm:space-y-3 relative z-10'}>
            {isLoading ? (
              Array.from({ length: viewMode === 'grid' ? 6 : 3 }).map((_, i) => (
                viewMode === 'grid' ? (
                  <PoolSkeletonGrid key={i} />
                ) : (
                  <PoolSkeletonList key={i} />
                )
              ))
            ) : filteredPools.length === 0 ? (
              <div className="text-center py-12 col-span-full">
                <Sprout className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No staking pools found</p>
                <p className="text-sm text-gray-400 mt-2">
                  {stakingPools.length === 0
                    ? 'No pools have been added to staking yet.'
                    : 'No pools match your search.'}
                </p>
              </div>
            ) : (
              filteredPools.map((pool) => (
                <StakingPoolCard
                  key={pool.poolAddress}
                  pool={pool}
                  viewMode={viewMode}
                  onStakeClick={() => {
                    setSelectedPool(pool.poolAddress);
                    setActiveTab('stake');
                  }}
                  onUnstakeClick={() => {
                    setSelectedPool(pool.poolAddress);
                    setActiveTab('unstake');
                  }}
                  onClaimClick={() => handleClaimRewards(pool.poolAddress)}
                />
              ))
            )}
          </div>
        )}

        {/* Stake Tab */}
        {activeTab === 'stake' && (
          <div className="bg-white/60 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/40 relative z-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Stake LP Tokens</h2>

            {/* Show LP Balance Selector if user has LP, otherwise show token pair selector */}
            {userLPBalances.length > 0 ? (
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Select LP Pool to Stake</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {userLPBalances.map((lpBalance) => {
                    const hasBalance = parseFloat(lpBalance.lpBalance) > 0;
                    const isSelected = selectedPool?.toLowerCase() === lpBalance.poolAddress.toLowerCase();
                    
                    return (
                      <motion.button
                        key={lpBalance.poolAddress}
                        onClick={() => {
                          setSelectedPool(lpBalance.poolAddress);
                          // Find token symbols from stakingPools
                          const pool = stakingPools.find(p => 
                            p.poolAddress.toLowerCase() === lpBalance.poolAddress.toLowerCase()
                          );
                          if (pool) {
                            setTokenA(pool.tokenASymbol as TokenSymbol);
                            setTokenB(pool.tokenBSymbol as TokenSymbol);
                          }
                        }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                          isSelected
                            ? 'border-orange-500 bg-gradient-to-r from-orange-50/90 to-orange-100/90 backdrop-blur-lg'
                            : 'border-white/40 bg-white/60 backdrop-blur-lg hover:border-orange-300 hover:bg-white/80'
                        }`}
                        style={{
                          boxShadow: isSelected
                            ? `
                              inset 0 1px 0 rgba(255, 255, 255, 0.9),
                              inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                              0 4px 12px rgba(251, 146, 60, 0.3),
                              0 2px 4px rgba(0, 0, 0, 0.1)
                            `
                            : `
                              inset 0 1px 0 rgba(255, 255, 255, 0.9),
                              inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                              0 2px 8px rgba(0, 0, 0, 0.08)
                            `,
                        }}
                      >
                        <div className="flex flex-col items-center text-center relative z-10">
                          <div className="flex -space-x-3 mb-2">
                            <div className="relative border-2 border-white shadow-xl rounded-full z-10" style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}>
                              <TokenLogo token={lpBalance.tokenASymbol as TokenSymbol} size={32} />
                            </div>
                            <div className="relative border-2 border-white shadow-xl rounded-full z-0" style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}>
                              <TokenLogo token={lpBalance.tokenBSymbol as TokenSymbol} size={32} />
                            </div>
                          </div>
                          <div className="w-full">
                            <div className="font-bold text-sm text-gray-900 mb-0.5">
                              {lpBalance.tokenASymbol} / {lpBalance.tokenBSymbol}
                            </div>
                            <div className="text-xs font-semibold text-orange-600 mb-1.5">
                              {parseFloat(lpBalance.lpBalance).toFixed(5)} LP
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-4 h-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg mx-auto"
                                style={{
                                  boxShadow: `
                                    inset 0 2px 4px rgba(255, 255, 255, 0.3),
                                    0 2px 4px rgba(251, 146, 60, 0.4)
                                  `,
                                }}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mb-4 sm:mb-6 bg-yellow-50/80 backdrop-blur-sm border border-yellow-200 rounded-lg sm:rounded-xl p-4 sm:p-5 text-center">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm sm:text-base text-yellow-800 font-semibold mb-1">No Staked Positions</p>
                <p className="text-xs sm:text-sm text-yellow-700">You don't have any LP tokens staked. Stake some LP tokens first to see them here.</p>
              </div>
            )}

            {/* Amount Input - only show if a pool is selected */}
            {selectedPool && userLPBalances.find(lp => lp.poolAddress.toLowerCase() === selectedPool.toLowerCase()) && (
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                  Amount to Stake
                </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.00001"
                  value={stakeAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow up to 5 decimal places
                    if (value === '' || /^\d*\.?\d{0,5}$/.test(value)) {
                      setStakeAmount(value);
                    }
                  }}
                  placeholder="0.0"
                  className="w-full bg-white/70 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-base sm:text-lg font-bold focus:border-orange-500 focus:outline-none text-gray-900 pr-16 sm:pr-20"
                  style={{
                    boxShadow: `
                      inset 0 1px 0 rgba(255, 255, 255, 0.9),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                      0 4px 12px rgba(0, 0, 0, 0.08),
                      0 2px 4px rgba(0, 0, 0, 0.04)
                    `,
                  }}
                />
                <button
                  onClick={() => {
                    // Get LP balance from selected pool if available, otherwise use hook value
                    if (selectedPool && userLPBalances.length > 0) {
                      const selectedLP = userLPBalances.find(lp => 
                        lp.poolAddress.toLowerCase() === selectedPool.toLowerCase()
                      );
                      if (selectedLP) {
                        // Use the exact balance value, but truncate to avoid rounding issues
                        const balance = parseFloat(selectedLP.lpBalance);
                        // Truncate to 5 decimal places first to avoid floating point precision issues
                        const truncated = Math.floor(balance * 100000) / 100000;
                        // Subtract a larger safety margin (0.00001) to ensure we're always well below balance
                        // This prevents rounding issues when converting back to wei
                        const maxAmount = Math.max(0, truncated - 0.00001);
                        // Truncate to 4 decimals for extra safety (no rounding)
                        const safeAmount = Math.floor(maxAmount * 10000) / 10000;
                        setStakeAmount(safeAmount > 0 ? safeAmount.toFixed(4) : '0');
                        return;
                      }
                    }
                    // Fallback to hook value
                    const balance = parseFloat(lpBalance);
                    // Truncate to 5 decimal places first
                    const truncated = Math.floor(balance * 100000) / 100000;
                    // Subtract larger safety margin and truncate to 4 decimals for extra safety
                    const maxAmount = Math.max(0, truncated - 0.00001);
                    const safeAmount = Math.floor(maxAmount * 10000) / 10000;
                    setStakeAmount(safeAmount > 0 ? safeAmount.toFixed(4) : '0');
                  }}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold hover:from-orange-600 hover:to-orange-700 transition-all"
                  style={{
                    boxShadow: `
                      inset 0 2px 4px rgba(255, 255, 255, 0.3),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                      0 4px 12px rgba(251, 146, 60, 0.4),
                      0 2px 4px rgba(0, 0, 0, 0.1)
                    `,
                  }}
                >
                  MAX
                </button>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm text-gray-600 mt-2 font-medium">
                <span>Available: <span className="font-bold text-orange-600">
                  {selectedPool && userLPBalances.length > 0 
                    ? (() => {
                        const selectedLP = userLPBalances.find(lp => 
                          lp.poolAddress.toLowerCase() === selectedPool.toLowerCase()
                        );
                        return selectedLP ? parseFloat(selectedLP.lpBalance).toFixed(5) : parseFloat(lpBalance).toFixed(5);
                      })()
                    : parseFloat(lpBalance).toFixed(5)
                  } LP
                </span></span>
                {(() => {
                  // Calculate APY from Supabase data (more accurate than contract)
                  const selectedPool = stakingPools.find(p => 
                    poolAddress && p.poolAddress.toLowerCase() === poolAddress.toLowerCase()
                  );
                  
                  let poolAPY: number | undefined;
                  if (selectedPool) {
                    poolAPY = calculateAPY(selectedPool);
                  } else if (stakingInfo.apy !== undefined) {
                    poolAPY = stakingInfo.apy;
                  }
                  
                  // Format APY if valid
                  let apyDisplay = 'N/A';
                  if (poolAPY !== undefined && isFinite(poolAPY) && poolAPY >= 0) {
                    if (poolAPY >= 1000000) {
                      apyDisplay = `${(poolAPY / 1000000).toFixed(2)}M%`;
                    } else if (poolAPY >= 1000) {
                      apyDisplay = `${(poolAPY / 1000).toFixed(2)}K%`;
                    } else {
                      apyDisplay = `${poolAPY.toFixed(2)}%`;
                    }
                  }
                  
                  return (
                    <span className="flex items-center gap-1">
                      APY: <span className="font-bold text-green-600">
                        {apyDisplay}
                      </span>
                      {apyDisplay === 'N/A' && (
                        <span 
                          className="text-xs text-gray-400 cursor-help" 
                          title="APY will appear once someone stakes LP tokens in this pool"
                        >
                          ℹ️
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
            </div>
            )}

            {/* Info */}
            {stakingInfo.poolInfo && (
              <div className="bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-blue-800">
                    <p className="font-semibold mb-1">Pool Info:</p>
                    <p className="break-words">Reward Rate: {(() => {
                      // Always use reward rate from Supabase (pool.rewardRate) - it's updated by indexer
                      if (poolAddress) {
                        const selectedPool = stakingPools.find(p => p.poolAddress.toLowerCase() === poolAddress.toLowerCase());
                        if (selectedPool?.rewardRate) {
                          return formatRewardRate(selectedPool.rewardRate);
                        }
                      }
                      // Fallback to contract if Supabase data not available yet
                      return parseFloat(formatUnits(stakingInfo.poolInfo?.rewardRate || BigInt(0), 18)).toFixed(3);
                    })()} DOA/sec</p>
                    <p className="break-words">Total Staked: {parseFloat(formatUnits(stakingInfo.poolInfo.totalStaked, 18)).toFixed(2)} LP</p>
                    {!stakingInfo.poolInfo.isActive && (
                      <p className="text-red-600 font-semibold mt-1">⚠️ Pool is not active</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stake Button */}
            <button
              onClick={handleStake}
              disabled={
                !poolAddress ||
                !stakeAmount ||
                parseFloat(stakeAmount) <= 0 ||
                (() => {
                  // Get the correct LP balance for validation
                  const currentLPBalance = selectedPool && userLPBalances.length > 0
                    ? userLPBalances.find(lp => lp.poolAddress.toLowerCase() === selectedPool.toLowerCase())?.lpBalance || '0'
                    : lpBalance;
                  // Use a small epsilon for floating point comparison to avoid precision issues
                  return parseFloat(stakeAmount) > parseFloat(currentLPBalance || '0') + 0.000001;
                })() ||
                (actionStep === 'approving' || actionStep === 'staking') ||
                !stakingInfo.poolInfo?.isActive
              }
              className={`w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-bold text-sm sm:text-lg transition-all flex items-center justify-center gap-2 ${
                (actionStep === 'approving' || actionStep === 'staking')
                  ? 'opacity-75 cursor-wait'
                  : 'hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              style={{
                boxShadow: `
                  inset 0 2px 4px rgba(255, 255, 255, 0.3),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                  0 4px 12px rgba(251, 146, 60, 0.4),
                  0 2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              {actionStep === 'approving' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Approving...
                </>
              ) : actionStep === 'staking' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Staking...
                </>
              ) : !lpApproval.isApproved ? (
                <>
                  <ArrowUpDown className="w-6 h-6" />
                  Approve & Stake
                </>
              ) : (
                <>
                  <Sprout className="w-6 h-6" />
                  Stake LP Tokens
                </>
              )}
            </button>
          </div>
        )}

        {/* Unstake Tab */}
        {activeTab === 'unstake' && (
          <div className="bg-white/60 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/40 relative z-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Unstake LP Tokens</h2>

            {/* Show Staked Positions from Supabase - always fetch from database */}
            {stakingPools.filter(p => {
              try {
                const staked = parseFloat(formatUnits(BigInt(p.userStaked || '0'), 18));
                return staked > 0;
              } catch {
                return false;
              }
            }).length > 0 ? (
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Select Staked Pool to Unstake</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {stakingPools
                    .filter(p => {
                      const staked = parseFloat(formatUnits(BigInt(p.userStaked || '0'), 18));
                      return staked > 0;
                    })
                    .map((pool) => {
                      const isSelected = selectedPool?.toLowerCase() === pool.poolAddress.toLowerCase();
                      const poolStaked = parseFloat(formatUnits(BigInt(pool.userStaked || '0'), 18));
                      
                      return (
                        <motion.button
                          key={pool.poolAddress}
                          onClick={() => {
                            setSelectedPool(pool.poolAddress);
                            setTokenA(pool.tokenASymbol as TokenSymbol);
                            setTokenB(pool.tokenBSymbol as TokenSymbol);
                          }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                            isSelected
                              ? 'border-orange-500 bg-gradient-to-r from-orange-50/90 to-orange-100/90 backdrop-blur-lg'
                              : 'border-white/40 bg-white/60 backdrop-blur-lg hover:border-orange-300 hover:bg-white/80'
                          }`}
                          style={{
                            boxShadow: isSelected
                              ? `
                                inset 0 1px 0 rgba(255, 255, 255, 0.9),
                                inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                                0 4px 12px rgba(251, 146, 60, 0.3),
                                0 2px 4px rgba(0, 0, 0, 0.1)
                              `
                              : `
                                inset 0 1px 0 rgba(255, 255, 255, 0.9),
                                inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                                0 2px 8px rgba(0, 0, 0, 0.08)
                              `,
                          }}
                        >
                          <div className="flex flex-col items-center text-center relative z-10">
                            <div className="flex -space-x-3 mb-2">
                              <div className="relative border-2 border-white shadow-xl rounded-full z-10" style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}>
                                <TokenLogo token={pool.tokenASymbol as TokenSymbol} size={32} />
                              </div>
                              <div className="relative border-2 border-white shadow-xl rounded-full z-0" style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}>
                                <TokenLogo token={pool.tokenBSymbol as TokenSymbol} size={32} />
                              </div>
                            </div>
                            <div className="w-full">
                              <div className="font-bold text-sm text-gray-900 mb-0.5">
                                {pool.tokenASymbol} / {pool.tokenBSymbol}
                              </div>
                              <div className="text-xs font-semibold text-orange-600 mb-1.5">
                                Staked: {parseFloat(formatUnits(BigInt(pool.userStaked || '0'), 18)).toFixed(5)} LP
                              </div>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-4 h-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg mx-auto"
                                  style={{
                                    boxShadow: `
                                      inset 0 2px 4px rgba(255, 255, 255, 0.3),
                                      0 2px 4px rgba(251, 146, 60, 0.4)
                                    `,
                                  }}
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="mb-4 sm:mb-6 bg-yellow-50/80 backdrop-blur-sm border border-yellow-200 rounded-lg sm:rounded-xl p-4 sm:p-5 text-center">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm sm:text-base text-yellow-800 font-semibold mb-1">No Staked Positions</p>
                <p className="text-xs sm:text-sm text-yellow-700">You don't have any LP tokens staked. Stake some LP tokens first to see them here.</p>
              </div>
            )}

            {/* Amount Input - only show if a pool is selected */}
            {selectedPool && stakingPools.find(p => {
              try {
                const staked = parseFloat(formatUnits(BigInt(p.userStaked || '0'), 18));
                return p.poolAddress.toLowerCase() === selectedPool.toLowerCase() && staked > 0;
              } catch {
                return false;
              }
            }) && (
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                  Amount to Unstake
                </label>
                <div className="relative">
                    <input
                    type="number"
                    step="0.00001"
                    value={unstakeAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow up to 5 decimal places
                      if (value === '' || /^\d*\.?\d{0,5}$/.test(value)) {
                        setUnstakeAmount(value);
                      }
                    }}
                    placeholder="0.0"
                    className="w-full bg-white/70 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-base sm:text-lg font-bold focus:border-orange-500 focus:outline-none text-gray-900 pr-16 sm:pr-20"
                    style={{
                      boxShadow: `
                        inset 0 1px 0 rgba(255, 255, 255, 0.9),
                        inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                        0 4px 12px rgba(0, 0, 0, 0.08),
                        0 2px 4px rgba(0, 0, 0, 0.04)
                      `,
                    }}
                  />
                  <button
                  onClick={() => {
                    const selectedPoolData = stakingPools.find(p => 
                      p.poolAddress.toLowerCase() === selectedPool.toLowerCase()
                    );
                    const staked = parseFloat(formatUnits(BigInt(selectedPoolData?.userStaked || '0'), 18));
                    setUnstakeAmount(staked > 0 ? staked.toFixed(5) : '0');
                  }}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold hover:from-orange-600 hover:to-orange-700 transition-all"
                    style={{
                      boxShadow: `
                        inset 0 2px 4px rgba(255, 255, 255, 0.3),
                        inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                        0 4px 12px rgba(251, 146, 60, 0.4),
                        0 2px 4px rgba(0, 0, 0, 0.1)
                      `,
                    }}
                  >
                    MAX
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm text-gray-600 mt-2 font-medium">
                  <span>Staked: <span className="font-bold text-orange-600">
                    {(() => {
                      const selectedPoolData = stakingPools.find(p => 
                        p.poolAddress.toLowerCase() === selectedPool.toLowerCase()
                      );
                      return parseFloat(formatUnits(BigInt(selectedPoolData?.userStaked || '0'), 18)).toFixed(5);
                    })()} LP
                  </span></span>
                  <span>Pending: <span className="font-bold text-green-600">
                    {(() => {
                      const selectedPoolData = stakingPools.find(p => 
                        p.poolAddress.toLowerCase() === selectedPool.toLowerCase()
                      );
                      return parseFloat(formatUnits(BigInt(selectedPoolData?.accumulatedRewards || '0'), 18)).toFixed(5);
                    })()} DOA
                  </span></span>
                </div>
              </div>
            )}

            {/* Unstake Button - only show if pool is selected */}
            {selectedPool && stakingPools.find(p => {
              const staked = parseFloat(formatUnits(BigInt(p.userStaked || '0'), 18));
              return p.poolAddress.toLowerCase() === selectedPool.toLowerCase() && staked > 0;
            }) && (
              <button
                onClick={handleUnstake}
                disabled={
                  !poolAddress ||
                  !unstakeAmount ||
                  parseFloat(unstakeAmount) <= 0 ||
                  (() => {
                    const selectedPoolData = stakingPools.find(p => 
                      p.poolAddress.toLowerCase() === selectedPool.toLowerCase()
                    );
                    const maxStaked = parseFloat(formatUnits(BigInt(selectedPoolData?.userStaked || '0'), 18));
                    return parseFloat(unstakeAmount) > maxStaked;
                  })() ||
                  actionStep !== 'none' ||
                  isPending
                }
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-bold text-sm sm:text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                boxShadow: `
                  inset 0 2px 4px rgba(255, 255, 255, 0.3),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                  0 4px 12px rgba(239, 68, 68, 0.4),
                  0 2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              {actionStep === 'unstaking' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Unstaking...
                </>
              ) : (
                <>
                  <ArrowUpDown className="w-6 h-6" />
                  Unstake LP Tokens
                </>
              )}
              </button>
            )}

            {/* Accumulated Rewards (Claiming Disabled) */}
            {parseFloat(stakingInfo.pendingRewards) > 0 && (
              <div className="w-full mt-4">
                <div className="bg-gradient-to-r from-yellow-50/80 to-orange-50/80 backdrop-blur-sm border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 flex items-center gap-2 sm:gap-3">
                  <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm sm:text-lg font-bold text-yellow-800">
                      {parseFloat(stakingInfo.pendingRewards).toFixed(5)} DOA Accumulated
                    </div>
                    <div className="text-xs sm:text-sm text-yellow-700 mt-1">
                      Rewards will be distributed via future claim. Keep staking to accumulate more!
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleClaimRewards(poolAddress!)}
                  disabled={true}
                  className="w-full bg-gray-300/80 backdrop-blur-sm text-gray-600 py-3 px-6 rounded-xl font-semibold cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200"
                  title="Claiming is disabled. Rewards will be distributed via future claim."
                >
                  <HelpCircle className="w-5 h-5" />
                  Claiming Disabled (Future Claim)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress Modal - Same pattern as Swap.tsx */}
        <AnimatePresence>
          {showProgressModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => {
                // Don't close on background click during transaction
                // Only allow closing if we're not in an active step or if transaction is complete
                if (actionStep === 'none' || (actionStep === 'staking' && stakeHash && isSuccess && !isPending && !isConfirming)) {
                  setShowProgressModal(false);
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/30 overflow-hidden"
                style={{
                  boxShadow: `
                    inset 0 1px 0 rgba(255, 255, 255, 0.9),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                    0 0 30px rgba(251, 146, 60, 0.15),
                    0 0 60px rgba(251, 146, 60, 0.1),
                    0 10px 30px rgba(0, 0, 0, 0.1),
                    0 4px 8px rgba(0, 0, 0, 0.05)
                  `,
                }}
              >
                {/* Close Button */}
                {(actionStep === 'none' || (actionStep === 'staking' && stakeHash && isSuccess && !isPending && !isConfirming)) && (
                  <button
                    onClick={() => {
                      setShowProgressModal(false);
                      setActionStep('none');
                      setPendingStakeAfterApproval(null);
                      setApprovalHash(null);
                      setStakeHash(null);
                      setCompletedSteps(new Set());
                    }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {/* Header */}
                <motion.h3
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6"
                >
                  Staking Progress
                </motion.h3>

                <div className="space-y-6">
                  {/* Approving Step */}
                  {(actionStep === 'approving' || actionStep === 'staking') && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
                      style={{
                        boxShadow: `
                          inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                          inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                          0 4px 8px rgba(0, 0, 0, 0.05)
                        `,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                          {actionStep === 'approving' && (isPending || isConfirming) ? (
                            <motion.div
                              className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"
                              style={{
                                boxShadow: `
                                  inset 0 2px 4px rgba(255, 255, 255, 0.5),
                                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                                  0 4px 12px rgba(251, 146, 60, 0.4)
                                `,
                              }}
                            >
                              <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </motion.div>
                          ) : completedSteps.has('approval') || actionStep === 'staking' ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 200 }}
                              className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center"
                              style={{
                                boxShadow: `
                                  inset 0 2px 4px rgba(255, 255, 255, 0.5),
                                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                                  0 0 20px rgba(16, 185, 129, 0.4),
                                  0 4px 12px rgba(16, 185, 129, 0.3)
                                `,
                              }}
                            >
                              <CheckCircle2 className="w-6 h-6 text-white" />
                            </motion.div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300"
                              style={{
                                boxShadow: `
                                  inset 0 2px 4px rgba(255, 255, 255, 0.9),
                                  inset 0 -2px 4px rgba(0, 0, 0, 0.1)
                                `,
                              }}
                            >
                              <div className="w-6 h-6 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${
                            actionStep === 'approving' && (isPending || isConfirming)
                              ? 'text-orange-600'
                              : completedSteps.has('approval') || actionStep === 'staking'
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}>
                            Approve LP Token
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {actionStep === 'approving' && (isPending || isConfirming)
                              ? 'Waiting for confirmation...'
                              : completedSteps.has('approval') || actionStep === 'staking'
                              ? 'Approval completed'
                              : 'Allow the contract to spend your LP tokens'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Staking Step */}
                  {actionStep === 'staking' && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
                      style={{
                        boxShadow: `
                          inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                          inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                          0 4px 8px rgba(0, 0, 0, 0.05)
                        `,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                          {actionStep === 'staking' && (isPending || isConfirming) ? (
                            <motion.div
                              className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"
                              style={{
                                boxShadow: `
                                  inset 0 2px 4px rgba(255, 255, 255, 0.5),
                                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                                  0 4px 12px rgba(251, 146, 60, 0.4)
                                `,
                              }}
                            >
                              <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </motion.div>
                          ) : actionStep === 'staking' && stakeHash && isSuccess && !isPending && !isConfirming ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 200 }}
                              className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center"
                              style={{
                                boxShadow: `
                                  inset 0 2px 4px rgba(255, 255, 255, 0.5),
                                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                                  0 0 20px rgba(16, 185, 129, 0.4),
                                  0 4px 12px rgba(16, 185, 129, 0.3)
                                `,
                              }}
                            >
                              <CheckCircle2 className="w-6 h-6 text-white" />
                            </motion.div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300"
                              style={{
                                boxShadow: `
                                  inset 0 2px 4px rgba(255, 255, 255, 0.9),
                                  inset 0 -2px 4px rgba(0, 0, 0, 0.1)
                                `,
                              }}
                            >
                              <div className="w-6 h-6 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${
                            actionStep === 'staking' && (isPending || isConfirming)
                              ? 'text-orange-600'
                              : actionStep === 'staking' && stakeHash && isSuccess && !isPending && !isConfirming
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}>
                            Staking LP Tokens
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {actionStep === 'staking' && (isPending || isConfirming)
                              ? 'Waiting for confirmation...'
                              : actionStep === 'staking' && stakeHash && isSuccess && !isPending && !isConfirming
                              ? 'Successfully staked!'
                              : 'Staking your LP tokens'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Success Message - Only show after 5 second delay and staking is confirmed */}
                  {actionStep === 'staking' && stakeHash && hash === stakeHash && hash !== approvalHash && stakingTransactionStarted && isSuccess && !isPending && !isConfirming && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-green-50/80 backdrop-blur-sm rounded-xl border border-green-200"
                      style={{
                        boxShadow: `
                          inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                          inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                        `,
                      }}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <p className="text-sm font-medium text-green-800">
                          LP tokens staked successfully
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm rounded-xl border border-red-200 relative"
                      style={{
                        boxShadow: `
                          inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                          inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                        `,
                      }}
                    >
                      <button
                        onClick={() => {
                          setErrorMessage(null);
                          setShowProgressModal(false);
                          setActionStep('none');
                          setCompletedSteps(new Set());
                        }}
                        className="absolute top-2 right-2 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-sm font-medium text-red-800 pr-6">Transaction Failed</p>
                      <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Token Selector Modal */}
        <AnimatePresence>
          {showTokenSelector && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowTokenSelector(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Select Token</h3>
                  <button
                    onClick={() => setShowTokenSelector(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_TOKENS.map((token) => (
                    <button
                      key={token}
                      onClick={() => {
                        if (showTokenSelector === 'A') {
                          setTokenA(token);
                        } else {
                          setTokenB(token);
                        }
                        setShowTokenSelector(null);
                      }}
                      className="p-3 rounded-lg hover:bg-gray-100 flex items-center gap-2 transition-colors"
                    >
                      <TokenLogo token={token} size={24} />
                      <span className="font-semibold">{token}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function StakingPoolCard({
  pool,
  viewMode = 'list',
  onStakeClick,
  onUnstakeClick,
  onClaimClick,
}: {
  pool: StakingPoolInfo;
  viewMode?: 'list' | 'grid';
  onStakeClick: () => void;
  onUnstakeClick: () => void;
  onClaimClick: () => void;
}) {
  const { isConnected, address } = useAccount();
  
  // Convert from wei (18 decimals) to human-readable format
  const userStaked = parseFloat(formatUnits(BigInt(pool.userStaked || '0'), 18));
  const accumulatedRewards = parseFloat(formatUnits(BigInt(pool.accumulatedRewards || '0'), 18));
  const totalStaked = parseFloat(formatUnits(BigInt(pool.totalStaked || '0'), 18));
  
  // Reward rate from Supabase is stored as string (wei), we'll format it in display

  // Format numbers (up to 5 decimal places)
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(5);
  };
  
  // Format reward rate (show up to 3 decimal places for DOA/sec to show 0.005 correctly)
  // rewardRate from Supabase is stored as string in wei format
  const formatRewardRate = (rateStr: string) => {
    try {
      const rateWei = BigInt(rateStr || '0');
      const rate = parseFloat(formatUnits(rateWei, 18));
      // Use toFixed(3) to show 0.005 correctly (toFixed(2) would show 0.01)
      return rate.toFixed(3);
    } catch {
      return '0.000';
    }
  };

  // Grid view
  if (viewMode === 'grid') {
    return (
      <motion.div
        className="bg-white/60 backdrop-blur-lg rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/40 hover:border-orange-300 transition-all cursor-pointer group"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        style={{
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(0, 0, 0, 0.05),
            0 10px 30px rgba(0, 0, 0, 0.1),
            0 4px 8px rgba(0, 0, 0, 0.05)
          `
        }}
      >
        {/* Pool Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-3 flex-shrink-0">
              <div className="relative border-2 border-white shadow-lg rounded-full z-10">
                <TokenLogo token={pool.tokenASymbol as TokenSymbol} size={28} className="flex-shrink-0" />
              </div>
              <div className="relative border-2 border-white shadow-lg rounded-full z-0">
                <TokenLogo token={pool.tokenBSymbol as TokenSymbol} size={28} className="flex-shrink-0" />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">
                {pool.tokenASymbol} / {pool.tokenBSymbol}
              </h3>
              <p className="text-xs text-gray-500">LP Pool</p>
            </div>
          </div>
          <a
            href={`${DEX_CONFIG.EXPLORER_URL}/address/${pool.poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center flex-shrink-0"
            aria-label="View on explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Top Row: You have LP tag and APY */}
        <div className="flex items-center justify-between mb-3">
          {userStaked > 0 ? (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
              You have LP
            </span>
          ) : (
            <div></div>
          )}
          {/* APY - opposite the You have LP tag */}
          <div className="bg-gray-50 rounded-lg px-2 py-1">
            <p className="text-xs text-gray-500 mb-0.5">APY</p>
            <p className="text-xs font-bold text-green-600">
              {(() => {
                try {
                  // Parse values from pool object (they come as strings from Supabase)
                  const rewardRateWei = BigInt(pool.rewardRate || '0');
                  const totalStakedWei = BigInt(pool.totalStaked || '0');
                  const userStakedWei = BigInt(pool.userStaked || '0');
                  
                  const rewardRatePerSecond = parseFloat(formatUnits(rewardRateWei, 18));
                  const totalStakedNum = parseFloat(formatUnits(totalStakedWei, 18));
                  const userStakedNum = parseFloat(formatUnits(userStakedWei, 18));
                  
                  // Use userStaked as fallback if totalStaked is 0 but user has staked
                  const effectiveTotalStaked = totalStakedNum > 0 ? totalStakedNum : (userStakedNum > 0 ? userStakedNum : 0);
                  
                  // Check isActive - handle boolean, string, or null values from Supabase
                  const isPoolActive = pool.isActive === true || String(pool.isActive).toLowerCase() === 'true';
                  
                  if (!isPoolActive || effectiveTotalStaked === 0 || rewardRatePerSecond === 0) {
                    return 'N/A';
                  }
                  
                  const secondsPerYear = 31536000;
                  const annualRewards = rewardRatePerSecond * secondsPerYear;
                  const apr = (annualRewards / effectiveTotalStaked) * 100;
                  
                  // Check for invalid values
                  if (!isFinite(apr) || apr < 0 || !isFinite(annualRewards) || !isFinite(effectiveTotalStaked)) {
                    return 'N/A';
                  }
                  
                  // Calculate APY with daily compounding
                  // For very high APR, Math.pow might return Infinity, so we need to handle it
                  let apy;
                  const dailyRate = (apr / 100) / 365;
                  
                  // If APR is extremely high (>100000%), Math.pow will return Infinity
                  // In that case, use a simplified calculation or show the APR directly
                  if (apr > 100000) {
                    // For extremely high APR, APY ≈ APR (compounding effect is negligible)
                    apy = apr;
                  } else {
                    apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;
                  }
                  
                  // Check for invalid APY values
                  if (!isFinite(apy) || apy < 0) {
                    // If APY is Infinity, show a very high value indicator
                    if (apy === Infinity || apy > 1e10) {
                      return '∞%';
                    }
                    return 'N/A';
                  }
                  
                  // Format APY - show actual value even if very high
                  let formatted;
                  if (apy >= 1000000) {
                    formatted = `${(apy / 1000000).toFixed(2)}M%`;
                  } else if (apy >= 1000) {
                    formatted = `${(apy / 1000).toFixed(2)}K%`;
                  } else {
                    formatted = `${apy.toFixed(2)}%`;
                  }
                  
                  return formatted;
                } catch (error) {
                  return 'N/A';
                }
              })()}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 mb-3">
          {/* Your Staked and Pending Rewards on same line */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-0.5">Your Staked</p>
              <p className="text-xs font-bold text-gray-900">{formatNumber(userStaked)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-0.5">Pending Rewards</p>
              <p className="text-xs font-bold text-green-600">{formatNumber(accumulatedRewards)} DOA</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-0.5">Total Staked</p>
              <p className="text-xs font-bold text-gray-900">{formatNumber(totalStaked)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-0.5">Reward Rate</p>
              <p className="text-xs font-bold text-blue-600">{formatRewardRate(pool.rewardRate)} DOA/s</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {userStaked > 0 ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStakeClick();
                }}
                className="flex-1 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1"
                title="Stake LP"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stake</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnstakeClick();
                }}
                className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-all flex items-center justify-center gap-1"
                title="Unstake LP"
              >
                <Minus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Unstake</span>
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStakeClick();
              }}
              className="w-full px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-all flex items-center justify-center gap-1"
              title="Stake LP"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Stake LP</span>
            </button>
          )}
        </div>

        {/* Accumulated Rewards */}
        {accumulatedRewards > 0 && (
          <div className="mt-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-yellow-800">
                  {formatNumber(accumulatedRewards)} DOA
                </div>
                <div className="text-xs text-yellow-700">Future claim</div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // List view
  return (
    <motion.div
      className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 sm:p-5 border border-white/40 hover:border-orange-300 transition-all cursor-pointer group"
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.98 }}
      style={{
        boxShadow: `
          inset 0 1px 0 rgba(255, 255, 255, 0.9),
          inset 0 -1px 0 rgba(0, 0, 0, 0.05),
          0 10px 30px rgba(0, 0, 0, 0.1),
          0 4px 8px rgba(0, 0, 0, 0.05)
        `
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* Pool Info */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="flex -space-x-4 sm:-space-x-6 flex-shrink-0">
            <div className="relative border-2 border-white shadow-lg rounded-full z-10">
              <TokenLogo token={pool.tokenASymbol as TokenSymbol} size={28} className="sm:w-9 sm:h-9 flex-shrink-0" />
            </div>
            <div className="relative border-2 border-white shadow-lg rounded-full z-0">
              <TokenLogo token={pool.tokenBSymbol as TokenSymbol} size={28} className="sm:w-9 sm:h-9 flex-shrink-0" />
            </div>
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 truncate">
              {pool.tokenASymbol} / {pool.tokenBSymbol}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
              <p className="text-xs text-gray-500">LP Pool</p>
              {userStaked > 0 && (
                <span className="px-1.5 sm:px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  You have LP
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3 md:gap-4 lg:gap-6 w-full sm:w-auto sm:flex-1 sm:max-w-2xl">
          <div>
            <p className="text-xs text-gray-500 mb-1">Your Staked</p>
            <p className="text-xs sm:text-sm font-bold text-gray-900">
              {formatNumber(userStaked)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Pending Rewards</p>
            <p className="text-xs sm:text-sm font-bold text-green-600">
              {formatNumber(accumulatedRewards)} DOA
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Staked</p>
            <p className="text-xs sm:text-sm font-bold text-gray-900">
              {formatNumber(totalStaked)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Reward Rate</p>
            <p className="text-xs sm:text-sm font-bold text-blue-600">
              {formatRewardRate(pool.rewardRate)} DOA/s
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">APY</p>
            <p className="text-xs sm:text-sm font-bold text-green-600">
              {(() => {
                try {
                  // Parse values from pool object (they come as strings from Supabase)
                  const rewardRateWei = BigInt(pool.rewardRate || '0');
                  const totalStakedWei = BigInt(pool.totalStaked || '0');
                  const userStakedWei = BigInt(pool.userStaked || '0');
                  
                  const rewardRatePerSecond = parseFloat(formatUnits(rewardRateWei, 18));
                  const totalStakedNum = parseFloat(formatUnits(totalStakedWei, 18));
                  const userStakedNum = parseFloat(formatUnits(userStakedWei, 18));
                  
                  // Use userStaked as fallback if totalStaked is 0 but user has staked
                  const effectiveTotalStaked = totalStakedNum > 0 ? totalStakedNum : (userStakedNum > 0 ? userStakedNum : 0);
                  
                  // Check isActive - handle boolean, string, or null values from Supabase
                  const isPoolActive = pool.isActive === true || String(pool.isActive).toLowerCase() === 'true';
                  
                  if (!isPoolActive || effectiveTotalStaked === 0 || rewardRatePerSecond === 0) {
                    return 'N/A';
                  }
                  
                  const secondsPerYear = 31536000;
                  const annualRewards = rewardRatePerSecond * secondsPerYear;
                  const apr = (annualRewards / effectiveTotalStaked) * 100;
                  
                  // Check for invalid values
                  if (!isFinite(apr) || apr < 0 || !isFinite(annualRewards) || !isFinite(effectiveTotalStaked)) {
                    return 'N/A';
                  }
                  
                  // Calculate APY with daily compounding
                  // For very high APR, Math.pow might return Infinity, so we need to handle it
                  let apy;
                  const dailyRate = (apr / 100) / 365;
                  
                  // If APR is extremely high (>100000%), Math.pow will return Infinity
                  // In that case, use a simplified calculation or show the APR directly
                  if (apr > 100000) {
                    // For extremely high APR, APY ≈ APR (compounding effect is negligible)
                    apy = apr;
                  } else {
                    apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;
                  }
                  
                  // Check for invalid APY values
                  if (!isFinite(apy) || apy < 0) {
                    // If APY is Infinity, show a very high value indicator
                    if (apy === Infinity || apy > 1e10) {
                      return '∞%';
                    }
                    return 'N/A';
                  }
                  
                  // Format APY - show actual value even if very high
                  let formatted;
                  if (apy >= 1000000) {
                    formatted = `${(apy / 1000000).toFixed(2)}M%`;
                  } else if (apy >= 1000) {
                    formatted = `${(apy / 1000).toFixed(2)}K%`;
                  } else {
                    formatted = `${apy.toFixed(2)}%`;
                  }
                  
                  return formatted;
                } catch (error) {
                  return 'N/A';
                }
              })()}
            </p>
          </div>
          <div className="flex items-center justify-end sm:justify-end gap-2">
            <a
              href={`${DEX_CONFIG.EXPLORER_URL}/address/${pool.poolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center"
              aria-label="View on explorer"
              title="View pool on explorer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            {userStaked > 0 ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStakeClick();
                  }}
                  className="p-2 sm:p-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl transition-all flex items-center justify-center"
                  title="Stake LP"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstakeClick();
                  }}
                  className="p-2 sm:p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center justify-center"
                  title="Unstake LP"
                >
                  <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStakeClick();
                }}
                className="p-2 sm:p-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all flex items-center justify-center"
                title="Stake LP"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Accumulated Rewards Banner */}
      {accumulatedRewards > 0 && (
        <div className="mt-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-yellow-800">
              {formatNumber(accumulatedRewards)} DOA Accumulated
            </div>
            <div className="text-xs text-yellow-700">
              Rewards will be distributed via future claim
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
