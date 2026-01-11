import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits, Address } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  Zap,
  Eye
} from 'lucide-react';
import { DEX_CONFIG } from '../config/dex';
import { STAKING_REWARDS_ABI } from '../config/abis';

const STAKING_REWARDS_ADDRESS = DEX_CONFIG.STAKING_REWARDS_ADDRESS;

interface PoolInfo {
  poolAddress: Address;
  lpToken: Address;
  rewardRate: bigint;
  lastUpdateTime: bigint;
  rewardPerTokenStored: bigint;
  totalStaked: bigint;
  isActive: boolean;
}

export default function StakingAdmin() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [pools, setPools] = useState<Address[]>([]);
  const [poolInfos, setPoolInfos] = useState<Map<Address, PoolInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerAddress, setOwnerAddress] = useState<Address | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewingPool, setViewingPool] = useState<Address | null>(null);
  const [contractRewardRate, setContractRewardRate] = useState<Map<Address, string>>(new Map());
  const [totalEmitted, setTotalEmitted] = useState<Map<Address, string>>(new Map());
  const [loadingEmitted, setLoadingEmitted] = useState<Address | null>(null);

  // Add Pool Form
  const [showAddPool, setShowAddPool] = useState(false);
  const [newPoolAddress, setNewPoolAddress] = useState('');
  const [newLpTokenAddress, setNewLpTokenAddress] = useState('');
  const [newRewardRate, setNewRewardRate] = useState('0.05');

  // Update Rate Form
  const [updatingPool, setUpdatingPool] = useState<Address | null>(null);
  const [newRate, setNewRate] = useState('');

  // Batch Update
  const [batchRate, setBatchRate] = useState('0.05');

  // Check if user is owner
  const { data: contractOwner } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'owner',
  });

  // Check if contract is paused
  const { data: paused } = useReadContract({
    address: STAKING_REWARDS_ADDRESS,
    abi: STAKING_REWARDS_ABI,
    functionName: 'paused',
  });

  useEffect(() => {
    if (contractOwner) {
      setOwnerAddress(contractOwner as Address);
      setIsOwner(address?.toLowerCase() === (contractOwner as Address).toLowerCase());
    }
  }, [contractOwner, address]);

  useEffect(() => {
    if (paused !== undefined) {
      setIsPaused(paused as boolean);
    }
  }, [paused]);

  // Fetch all pools
  const fetchPools = useCallback(async () => {
    if (!publicClient) return;

    try {
      setIsLoading(true);
      const poolAddresses = await publicClient.readContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'getAllPools',
      }) as Address[];

      setPools(poolAddresses);

      // Fetch pool info for each pool
      const infos = new Map<Address, PoolInfo>();
      for (const poolAddr of poolAddresses) {
        try {
          const info = await publicClient.readContract({
            address: STAKING_REWARDS_ADDRESS,
            abi: STAKING_REWARDS_ABI,
            functionName: 'getPoolInfo',
            args: [poolAddr],
          }) as PoolInfo;

          infos.set(poolAddr, info);
        } catch (err) {
          console.error(`Error fetching pool info for ${poolAddr}:`, err);
        }
      }

      setPoolInfos(infos);
    } catch (error) {
      console.error('Error fetching pools:', error);
      setErrorMessage('Failed to fetch pools');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Clear messages after transaction
  useEffect(() => {
    if (isSuccess) {
      setSuccessMessage('Transaction successful!');
      setTimeout(() => {
        setSuccessMessage(null);
        fetchPools();
      }, 3000);
    }
    if (error) {
      setErrorMessage(error.message || 'Transaction failed');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [isSuccess, error, fetchPools]);

  const handleAddPool = async () => {
    if (!newPoolAddress || !newLpTokenAddress || !newRewardRate) {
      setErrorMessage('Please fill all fields');
      return;
    }

    try {
      const rateWei = parseUnits(newRewardRate, 18);
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'addPool',
        args: [newPoolAddress as Address, newLpTokenAddress as Address, rateWei],
      });
      setShowAddPool(false);
      setNewPoolAddress('');
      setNewLpTokenAddress('');
      setNewRewardRate('0.05');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add pool');
    }
  };

  const handleUpdateRate = async (poolAddress: Address) => {
    if (!newRate) {
      setErrorMessage('Please enter a new rate');
      return;
    }

    try {
      const rateWei = parseUnits(newRate, 18);
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'updateRewardRate',
        args: [poolAddress, rateWei],
      });
      setUpdatingPool(null);
      setNewRate('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update rate');
    }
  };

  const handleBatchUpdate = async () => {
    if (!batchRate) {
      setErrorMessage('Please enter a rate');
      return;
    }

    try {
      const rateWei = parseUnits(batchRate, 18);
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'updateAllPoolsRewardRate',
        args: [rateWei],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update all pools');
    }
  };

  const handleDeactivatePool = async (poolAddress: Address) => {
    if (!confirm('Are you sure you want to deactivate this pool? Users can still unstake but no new rewards will accumulate.')) {
      return;
    }

    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'deactivatePool',
        args: [poolAddress],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to deactivate pool');
    }
  };

  const handlePause = async () => {
    if (!confirm('Are you sure you want to pause the contract? This will prevent all new stakes and unstakes.')) {
      return;
    }

    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'pause',
        args: [],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to pause contract');
    }
  };

  const handleUnpause = async () => {
    try {
      writeContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'unpause',
        args: [],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to unpause contract');
    }
  };

  // View reward rate directly from contract
  const handleViewFromContract = async (poolAddress: Address) => {
    if (!publicClient) return;

    try {
      setViewingPool(poolAddress);
      setErrorMessage(null);
      
      const info = await publicClient.readContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'getPoolInfo',
        args: [poolAddress],
      }) as PoolInfo;

      const rate = parseFloat(formatUnits(info.rewardRate, 18));
      setContractRewardRate(prev => {
        const newMap = new Map(prev);
        newMap.set(poolAddress, rate.toFixed(6));
        return newMap;
      });
      
      setSuccessMessage(`Contract Reward Rate: ${rate.toFixed(6)} DOA/sec`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch from contract');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setViewingPool(null);
    }
  };

  // Calculate total emitted DOA for a pool from contract
  const handleViewTotalEmitted = async (poolAddress: Address) => {
    if (!publicClient) return;

    try {
      setLoadingEmitted(poolAddress);
      setErrorMessage(null);
      
      const info = await publicClient.readContract({
        address: STAKING_REWARDS_ADDRESS,
        abi: STAKING_REWARDS_ABI,
        functionName: 'getPoolInfo',
        args: [poolAddress],
      }) as PoolInfo;

      // Calculate total emitted: rewardPerTokenStored * totalStaked / 1e18
      // This represents the total rewards that have been distributed
      let totalEmittedWei = 0n;
      
      if (info.totalStaked > 0n && info.rewardPerTokenStored > 0n) {
        // Calculate current total emitted from stored values
        totalEmittedWei = (info.rewardPerTokenStored * info.totalStaked) / BigInt(1e18);
        
        // Also add any pending rewards since last update
        if (info.isActive && info.lastUpdateTime > 0n) {
          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          const timeElapsed = currentTime - info.lastUpdateTime;
          if (timeElapsed > 0n) {
            const pendingReward = info.rewardRate * timeElapsed;
            totalEmittedWei += pendingReward;
          }
        }
      }

      const totalEmittedFormatted = parseFloat(formatUnits(totalEmittedWei, 18));
      setTotalEmitted(prev => {
        const newMap = new Map(prev);
        newMap.set(poolAddress, totalEmittedFormatted.toFixed(6));
        return newMap;
      });
      
      setSuccessMessage(`Total Emitted: ${totalEmittedFormatted.toFixed(6)} DOA`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to calculate total emitted');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoadingEmitted(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/40 shadow-2xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Wallet</h2>
          <p className="text-gray-600">Please connect your Ledger wallet to access the admin panel</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/40 shadow-2xl max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You are not the owner of this contract</p>
          <p className="text-sm text-gray-500">
            Owner: <span className="font-mono text-xs break-all">{ownerAddress}</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Connected: <span className="font-mono text-xs break-all">{address}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/40 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Settings className="w-8 h-8 text-orange-600" />
                Staking Admin Panel
              </h1>
              <p className="text-gray-600 mt-2">Manage pools, reward rates, and staking settings</p>
            </div>
            <button
              onClick={fetchPools}
              disabled={isLoading}
              className="px-4 py-2 bg-white/60 backdrop-blur-lg rounded-xl text-gray-700 hover:bg-white/80 transition-all flex items-center gap-2 border border-white/40"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {successMessage}
            </motion.div>
          )}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause/Unpause Controls */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/40 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className={`w-5 h-5 ${isPaused ? 'text-red-600' : 'text-green-600'}`} />
            Contract Status: {isPaused ? (
              <span className="text-red-600">PAUSED</span>
            ) : (
              <span className="text-green-600">ACTIVE</span>
            )}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {isPaused 
              ? 'Contract is paused. No new stakes or unstakes are allowed, but rewards continue accumulating.'
              : 'Contract is active. All functions are operational.'}
          </p>
          <div className="flex gap-4">
            {isPaused ? (
              <button
                onClick={handleUnpause}
                disabled={isPending || isConfirming}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(isPending || isConfirming) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Unpausing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Unpause Contract
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={isPending || isConfirming}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(isPending || isConfirming) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Pausing...
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Pause Contract
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Batch Update All Pools */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/40 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600" />
            Batch Update All Pools
          </h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Reward Rate (DOA/sec)
              </label>
              <input
                type="number"
                step="0.001"
                value={batchRate}
                onChange={(e) => setBatchRate(e.target.value)}
                placeholder="0.05"
                className="w-full bg-white/60 backdrop-blur-lg border-2 border-white/40 rounded-xl p-3 text-gray-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleBatchUpdate}
              disabled={isPending || isConfirming}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(isPending || isConfirming) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Update All Pools
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            This will update all active pools to the specified reward rate
          </p>
        </div>

        {/* Add New Pool */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 mb-6 border border-white/40 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-600" />
              Add New Pool
            </h2>
            <button
              onClick={() => setShowAddPool(!showAddPool)}
              className="px-4 py-2 bg-white/60 backdrop-blur-lg rounded-xl text-gray-700 hover:bg-white/80 transition-all"
            >
              {showAddPool ? 'Cancel' : 'Add Pool'}
            </button>
          </div>

          <AnimatePresence>
            {showAddPool && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pool Address
                  </label>
                  <input
                    type="text"
                    value={newPoolAddress}
                    onChange={(e) => setNewPoolAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-white/60 backdrop-blur-lg border-2 border-white/40 rounded-xl p-3 text-gray-900 focus:border-orange-500 focus:outline-none font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    LP Token Address
                  </label>
                  <input
                    type="text"
                    value={newLpTokenAddress}
                    onChange={(e) => setNewLpTokenAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-white/60 backdrop-blur-lg border-2 border-white/40 rounded-xl p-3 text-gray-900 focus:border-orange-500 focus:outline-none font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reward Rate (DOA/sec)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={newRewardRate}
                    onChange={(e) => setNewRewardRate(e.target.value)}
                    placeholder="0.05"
                    className="w-full bg-white/60 backdrop-blur-lg border-2 border-white/40 rounded-xl p-3 text-gray-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAddPool}
                  disabled={isPending || isConfirming}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(isPending || isConfirming) ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Pool
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pools Grid */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/40 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-orange-600" />
            All Pools ({pools.length})
          </h2>

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading pools...</p>
            </div>
          ) : pools.length === 0 ? (
            <div className="text-center py-12">
              <Coins className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No pools found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pools.map((poolAddress) => {
                const info = poolInfos.get(poolAddress);
                if (!info) return null;

                const currentRate = parseFloat(formatUnits(info.rewardRate, 18));
                const totalStaked = parseFloat(formatUnits(info.totalStaked, 18));

                return (
                  <motion.div
                    key={poolAddress}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/60 backdrop-blur-lg rounded-2xl p-5 border border-white/40 hover:border-orange-300 transition-all shadow-lg hover:shadow-xl"
                  >
                    <div className="flex flex-col h-full">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-gray-900 font-mono text-xs break-all truncate">
                              {poolAddress}
                            </h3>
                            <a
                              href={`${DEX_CONFIG.EXPLORER_URL}/address/${poolAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:text-orange-700 flex-shrink-0"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          {info.isActive ? (
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                              Active
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
                        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Reward Rate</p>
                            <button
                              onClick={() => handleViewFromContract(poolAddress)}
                              disabled={viewingPool === poolAddress}
                              className="p-1 hover:bg-white/60 rounded transition-all disabled:opacity-50"
                              title="View from contract"
                            >
                              {viewingPool === poolAddress ? (
                                <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                              ) : (
                                <Eye className="w-3 h-3 text-orange-600 hover:text-orange-700" />
                              )}
                            </button>
                          </div>
                          <p className="font-bold text-gray-900 text-sm">
                            {currentRate.toFixed(6)} DOA/sec
                          </p>
                          {contractRewardRate.has(poolAddress) && (
                            <p className="text-xs text-green-600 mt-1 font-semibold">
                              Contract: {contractRewardRate.get(poolAddress)} DOA/sec
                            </p>
                          )}
                        </div>
                        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">Total Staked</p>
                          <p className="font-bold text-gray-900 text-sm flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {totalStaked.toFixed(5)} LP
                          </p>
                        </div>
                        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3 col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Total Emitted DOA</p>
                            <button
                              onClick={() => handleViewTotalEmitted(poolAddress)}
                              disabled={loadingEmitted === poolAddress}
                              className="p-1 hover:bg-white/60 rounded transition-all disabled:opacity-50 flex items-center gap-1"
                              title="Calculate from contract"
                            >
                              {loadingEmitted === poolAddress ? (
                                <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                              ) : (
                                <>
                                  <Eye className="w-3 h-3 text-orange-600 hover:text-orange-700" />
                                  <span className="text-xs text-orange-600">View</span>
                                </>
                              )}
                            </button>
                          </div>
                          {totalEmitted.has(poolAddress) ? (
                            <p className="font-bold text-green-600 text-sm">
                              {totalEmitted.get(poolAddress)} DOA
                            </p>
                          ) : (
                            <p className="font-bold text-gray-400 text-sm">Click to calculate</p>
                          )}
                        </div>
                        <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3 col-span-2">
                          <p className="text-xs text-gray-500 mb-1">LP Token</p>
                          <p className="font-mono text-xs text-gray-700 break-all truncate">{info.lpToken}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 mt-auto">
                        {updatingPool === poolAddress ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.001"
                              value={newRate}
                              onChange={(e) => setNewRate(e.target.value)}
                              placeholder="0.05"
                              className="flex-1 bg-white/60 backdrop-blur-lg border-2 border-white/40 rounded-xl p-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none"
                            />
                            <button
                              onClick={() => handleUpdateRate(poolAddress)}
                              disabled={isPending || isConfirming}
                              className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setUpdatingPool(null);
                                setNewRate('');
                              }}
                              className="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm font-semibold hover:bg-gray-600 transition-all flex items-center justify-center"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setUpdatingPool(poolAddress)}
                              disabled={isPending || isConfirming || !info.isActive}
                              className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <TrendingUp className="w-4 h-4" />
                              Update Rate
                            </button>
                            {info.isActive && (
                              <button
                                onClick={() => handleDeactivatePool(poolAddress)}
                                disabled={isPending || isConfirming}
                                className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-semibold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Deactivate
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
