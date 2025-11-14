import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { formatUnits, isAddress, parseUnits, type Address } from 'viem';
import { useDEX, useTokenBalance, usePoolReserves, TOKENS, type TokenSymbol } from '../hooks/useDEX';
import { ERC20_ABI } from '../config/abis';
import TokenLogo from './TokenLogo';

interface AddLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenA: string; // Token address or symbol
  tokenB: string; // Token address or symbol
  tokenASymbol: string;
  tokenBSymbol: string;
}

export default function AddLiquidityModal({
  isOpen,
  onClose,
  tokenA,
  tokenB,
  tokenASymbol,
  tokenBSymbol,
}: AddLiquidityModalProps) {
  const { address: walletAddress, isConnected: walletConnected, chainId } = useAccount();
  const isArcTestnet = chainId === 5042002;
  const publicClient = usePublicClient();

  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [approvalStep, setApprovalStep] = useState<'none' | 'approvingA' | 'approvingB' | 'adding'>('none');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liquiditySuccess, setLiquiditySuccess] = useState(false);
  const [modalManuallyClosed, setModalManuallyClosed] = useState(false);
  // Stable step completion tracking to prevent flickering
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  // Track the hash of the completed liquidity transaction to prevent duplicate success messages
  const [completedLiquidityHash, setCompletedLiquidityHash] = useState<`0x${string}` | null>(null);
  // Track the last transaction type to distinguish between approval and liquidity addition success
  const [lastTransactionType, setLastTransactionType] = useState<'approval' | 'liquidity' | null>(null);

  // Get token symbols (convert addresses to symbols if needed)
  const tokenAInfo = useMemo(() => {
    // Try to find in TOKENS by address or symbol
    const tokenEntry = Object.entries(TOKENS).find(
      ([tokenSymbol, info]) => 
        info.address.toLowerCase() === tokenA.toLowerCase() || 
        tokenSymbol.toLowerCase() === tokenA.toLowerCase()
    );
    return tokenEntry ? { tokenSymbol: tokenEntry[0] as TokenSymbol, ...tokenEntry[1] } : null;
  }, [tokenA]);

  const tokenBInfo = useMemo(() => {
    const tokenEntry = Object.entries(TOKENS).find(
      ([tokenSymbol, info]) => 
        info.address.toLowerCase() === tokenB.toLowerCase() || 
        tokenSymbol.toLowerCase() === tokenB.toLowerCase()
    );
    return tokenEntry ? { tokenSymbol: tokenEntry[0] as TokenSymbol, ...tokenEntry[1] } : null;
  }, [tokenB]);

  const finalTokenA = tokenAInfo?.tokenSymbol || (tokenASymbol as TokenSymbol);
  const finalTokenB = tokenBInfo?.tokenSymbol || (tokenBSymbol as TokenSymbol);

  const { addLiquidity, approveToken, isPending, isConfirming, isSuccess, error, hash } = useDEX();
  
  // Get token addresses
  const tokenAAddress = tokenAInfo?.address || (isAddress(tokenA) ? tokenA : undefined);
  const tokenBAddress = tokenBInfo?.address || (isAddress(tokenB) ? tokenB : undefined);
  
  // Get decimals directly from contracts if not in TOKENS map
  const { data: tokenADecimalsRaw } = useReadContract({
    address: tokenAAddress as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!tokenAAddress && !tokenAInfo },
  });
  
  const { data: tokenBDecimalsRaw } = useReadContract({
    address: tokenBAddress as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!tokenBAddress && !tokenBInfo },
  });

  // Read balance directly from contract addresses (works for all tokens)
  const { data: balanceARaw } = useReadContract({
    address: tokenAAddress as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && walletConnected && !!tokenAAddress && isArcTestnet },
  });
  
  const { data: balanceBRaw } = useReadContract({
    address: tokenBAddress as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && walletConnected && !!tokenBAddress && isArcTestnet },
  });

  // Get decimals (prefer from TOKENS map, otherwise from contract, default to 18)
  const tokenADecimals = tokenAInfo?.decimals || (tokenADecimalsRaw ? Number(tokenADecimalsRaw) : 18);
  const tokenBDecimals = tokenBInfo?.decimals || (tokenBDecimalsRaw ? Number(tokenBDecimalsRaw) : 18);

  // Format balances
  const balanceA = useMemo(() => {
    if (!balanceARaw) return '0';
    return formatUnits(balanceARaw, tokenADecimals);
  }, [balanceARaw, tokenADecimals]);

  const balanceB = useMemo(() => {
    if (!balanceBRaw) return '0';
    return formatUnits(balanceBRaw, tokenBDecimals);
  }, [balanceBRaw, tokenBDecimals]);

  const poolReserves = usePoolReserves(
    (tokenAInfo?.address || tokenA) as Address,
    (tokenBInfo?.address || tokenB) as Address
  );

  // Check if this is the first liquidity (pool has zero reserves)
  const isFirstLiquidity = useMemo(() => {
    const reserveA = parseFloat(poolReserves.reserveA || '0');
    const reserveB = parseFloat(poolReserves.reserveB || '0');
    return reserveA === 0 && reserveB === 0;
  }, [poolReserves]);

  // Calculate current price from reserves (only if pool has liquidity)
  // Price shows: 1 tokenA = X tokenB (how many tokenB per tokenA)
  const currentPrice = useMemo(() => {
    if (isFirstLiquidity) return null; // No price for new pools
    if (!poolReserves.reserveA || !poolReserves.reserveB || parseFloat(poolReserves.reserveA) <= 0) return null;
    // ReserveA = tokenA, ReserveB = tokenB
    // Price = reserveB / reserveA (how many tokenB per tokenA)
    return parseFloat(poolReserves.reserveB) / parseFloat(poolReserves.reserveA);
  }, [poolReserves, isFirstLiquidity]);

  // Calculate starting price from user inputs (for new pools)
  const startingPrice = useMemo(() => {
    if (!isFirstLiquidity) return null; // Only show for new pools
    if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) return null;
    return parseFloat(amountB) / parseFloat(amountA); // How much tokenB per tokenA
  }, [amountA, amountB, isFirstLiquidity]);

  // Auto-calculate amountB based on amountA and current price (only for existing pools)
  useEffect(() => {
    if (isFirstLiquidity) {
      // Don't auto-calculate for new pools - user sets both amounts to determine initial price
      return;
    }
    if (amountA && currentPrice && parseFloat(amountA) > 0) {
      // If 1 tokenA = currentPrice tokenB, then amountA tokenA = amountA * currentPrice tokenB
      const calculatedB = (parseFloat(amountA) * currentPrice).toFixed(6);
      setAmountB(calculatedB);
    } else if (!amountA) {
      setAmountB('');
    }
  }, [amountA, currentPrice, isFirstLiquidity]);

  // Get pool address
  const poolAddress = poolReserves.poolAddress;

  // Check if approvals are needed
  const [needsApproval, setNeedsApproval] = useState({ tokenA: false, tokenB: false });

  useEffect(() => {
    if (!isOpen || !poolAddress || !amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
      setNeedsApproval({ tokenA: false, tokenB: false });
      return;
    }

    const checkAllowances = async () => {
      // This will be handled by addLiquidity function
      setNeedsApproval({ tokenA: false, tokenB: false });
    };

    checkAllowances();
  }, [isOpen, poolAddress, amountA, amountB]);

  // Track progress
  useEffect(() => {
    // Don't reopen modal if it was manually closed after completion
    if (modalManuallyClosed && liquiditySuccess) {
      return;
    }
    
    // Reset manual close flag when new transaction starts
    if (isPending || isConfirming) {
      setModalManuallyClosed(false);
    }
    
    if (isPending || isConfirming) {
      // Keep progress modal open when transaction is in progress
      if (!showProgressModal) {
        setShowProgressModal(true);
      }
    } else if (isSuccess && hash) {
      // CRITICAL: Only show success for adding liquidity, not for approvals
      // Only show success if:
      // 1. We're in the 'adding' step (not approving)
      // 2. The last transaction was actually a liquidity addition (not an approval)
      // 3. We're not pending or confirming (transaction is actually complete)
      // 4. We haven't already shown success for this hash
      if (approvalStep === 'adding' && 
          lastTransactionType === 'liquidity' && 
          !isPending && 
          !isConfirming && 
          completedLiquidityHash !== hash) {
        // Mark this hash as completed to prevent duplicate success messages
        setCompletedLiquidityHash(hash);
        setCompletedSteps(prev => new Set(prev).add('adding')); // Mark adding liquidity as completed
        setLiquiditySuccess(true);
        // Auto-close after showing success
        setTimeout(() => {
          // Only auto-close if user hasn't manually closed
          if (showProgressModal && !modalManuallyClosed) {
            setShowProgressModal(false);
            setModalManuallyClosed(true); // Mark as manually closed to prevent blank modal
            setApprovalStep('none');
            setLiquiditySuccess(false);
            setCompletedApprovalStep('none');
            setCompletedLiquidityHash(null);
            setLastTransactionType(null);
            setCompletedSteps(new Set());
            // Reset and close after a delay
            setTimeout(() => {
              setAmountA('');
              setAmountB('');
              onClose();
            }, 100);
          }
        }, 2500);
      }
      // For approvals (approvingA or approvingB), DON'T show success - let auto-proceed handle it
      // The auto-proceed useEffect will take over and keep the modal open
    } else if (error && approvalStep === 'adding') {
      // Only show error modal for liquidity addition errors, not approval errors
      setErrorMessage(formatErrorMessage(error));
      setTimeout(() => {
        if (!modalManuallyClosed) {
          setShowProgressModal(false);
          setApprovalStep('none');
          setCompletedApprovalStep('none');
        }
      }, 3000);
    } else if (error && (approvalStep === 'approvingA' || approvalStep === 'approvingB')) {
      // Handle approval errors - keep modal open so user can see error
      setErrorMessage(formatErrorMessage(error));
      // Keep progress modal open to show error
      if (!showProgressModal) {
        setShowProgressModal(true);
      }
    } else if (!isPending && !isConfirming && !isSuccess && (approvalStep === 'approvingA' || approvalStep === 'approvingB')) {
      // If we're in approval state but no transaction is active, keep modal open
      // This prevents premature closing during approval->liquidity transition
      if (!showProgressModal && !modalManuallyClosed) {
        setShowProgressModal(true);
      }
    }
  }, [isPending, isConfirming, isSuccess, error, approvalStep, showProgressModal, onClose, liquiditySuccess, modalManuallyClosed, hash, completedLiquidityHash, lastTransactionType]);

  // Track which approval just completed to prevent duplicate triggers
  const [completedApprovalStep, setCompletedApprovalStep] = useState<'none' | 'approvingA' | 'approvingB'>('none');

  // Auto-proceed after approval completes
  useEffect(() => {
    // Only proceed when approval transaction succeeds and we haven't already processed this approval
    // IMPORTANT: Check that we're still in approval mode (not already moved to adding)
    if (isSuccess && !isPending && !isConfirming && poolAddress && (approvalStep === 'approvingA' || approvalStep === 'approvingB') && completedApprovalStep !== approvalStep) {
      const proceed = async () => {
        try {
          // Mark this approval as completed to prevent duplicate processing
          setCompletedApprovalStep(approvalStep);
          setCompletedSteps(prev => new Set(prev).add(approvalStep)); // Mark step as completed to prevent flickering
          
          // CRITICAL: Keep progress modal open during the entire flow
          if (!showProgressModal) {
            setShowProgressModal(true);
          }
          
          // Wait a bit for the blockchain to update
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Re-check if we still need approvals (in case something changed)
          if (!publicClient) {
            throw new Error('Public client not available');
          }

          const tokenAInfo = TOKENS[finalTokenA];
          const tokenBInfo = TOKENS[finalTokenB];
          const amountAWei = parseUnits(amountA, tokenAInfo.decimals);
          const amountBWei = parseUnits(amountB, tokenBInfo.decimals);

          // Check current allowances again
          const [allowanceA, allowanceB] = await Promise.all([
            publicClient.readContract({
              address: tokenAInfo.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [walletAddress!, poolAddress],
            }),
            publicClient.readContract({
              address: tokenBInfo.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [walletAddress!, poolAddress],
            }),
          ]);

          if (approvalStep === 'approvingA') {
            // Token A should be approved now, check if B also needs approval
            if (allowanceB < amountBWei) {
              // Still need to approve Token B
              setApprovalStep('approvingB');
              setCompletedApprovalStep('none'); // Reset to allow next approval
              setLastTransactionType('approval'); // Track that next transaction is approval
              setLiquiditySuccess(false); // Ensure liquidity success is false
              setShowProgressModal(true); // Keep modal open
              approveToken(finalTokenB, poolAddress);
            } else {
              // Both approved, proceed to add liquidity - KEEP MODAL OPEN
              setApprovalStep('adding');
              setCompletedApprovalStep('none'); // Reset
              setLastTransactionType('liquidity'); // Track that next transaction is liquidity addition
              setLiquiditySuccess(false); // Reset liquidity success before starting
              setShowProgressModal(true); // Ensure modal stays open during add liquidity
              await addLiquidity(finalTokenA, finalTokenB, amountA, amountB);
            }
          } else if (approvalStep === 'approvingB') {
            // Token B should be approved now, check if A is also approved
            if (allowanceA < amountAWei) {
              // This shouldn't happen, but handle it
              setApprovalStep('approvingA');
              setCompletedApprovalStep('none'); // Reset to allow next approval
              setLastTransactionType('approval'); // Track that next transaction is approval
              setLiquiditySuccess(false); // Ensure liquidity success is false
              setShowProgressModal(true);
              approveToken(finalTokenA, poolAddress);
            } else {
              // Both approved, proceed to add liquidity - KEEP MODAL OPEN
              setApprovalStep('adding');
              setCompletedApprovalStep('none'); // Reset
              setLastTransactionType('liquidity'); // Track that next transaction is liquidity addition
              setLiquiditySuccess(false); // Reset liquidity success before starting
              setShowProgressModal(true); // Ensure modal stays open during add liquidity
              await addLiquidity(finalTokenA, finalTokenB, amountA, amountB);
            }
          }
        } catch (err: any) {
          const errorMsg = err?.message || err?.toString() || '';
          
          // Handle approval errors that might occur during auto-proceed
          if (errorMsg.includes('NEED_APPROVE_A')) {
            setApprovalStep('approvingA');
            setCompletedApprovalStep('none');
            approveToken(finalTokenA, poolAddress);
          } else if (errorMsg.includes('NEED_APPROVE_B')) {
            setApprovalStep('approvingB');
            setCompletedApprovalStep('none');
            approveToken(finalTokenB, poolAddress);
          } else {
            setErrorMessage(formatErrorMessage(err));
            // Don't close modal on error, let user see what went wrong
          }
        }
      };
      proceed();
    }
  }, [isSuccess, approvalStep, poolAddress, finalTokenA, finalTokenB, amountA, amountB, approveToken, addLiquidity, isPending, isConfirming, publicClient, walletAddress, completedApprovalStep, showProgressModal]);

  const formatErrorMessage = (err: any): string => {
    if (!err) return 'Unknown error occurred';
    
    const errorStr = err.message || err.toString() || '';
    
    // Rate limiting errors (check first as it's common)
    if (errorStr.includes('rate limit') || 
        errorStr.includes('rate limited') ||
        errorStr.includes('Request is being rate limited') ||
        errorStr.includes('rate Limited')) {
      return 'The network is currently busy. Please wait a moment and try again.';
    }
    
    // User rejection errors
    if (errorStr.includes('User rejected') || 
        errorStr.includes('User denied') || 
        errorStr.includes('rejected the request') ||
        errorStr.includes('denied transaction signature')) {
      return 'Transaction was cancelled. Please try again when ready.';
    }
    
    // Network errors
    if (errorStr.includes('network') || errorStr.includes('Network')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    // Gas errors
    if (errorStr.includes('gas') || errorStr.includes('insufficient funds')) {
      return 'Insufficient funds for gas. Please ensure you have enough balance.';
    }
    
    // Allowance errors
    if (errorStr.includes('allowance') || errorStr.includes('Allowance')) {
      return 'Token approval required. Please approve and try again.';
    }
    
    // Pool errors
    if (errorStr.includes('Pool not found') || errorStr.includes('pool')) {
      return 'Pool not found. Please create the pool first.';
    }
    
    // For technical errors, extract just the reason if available
    if (errorStr.includes('reverted with the following reason:')) {
      const reasonMatch = errorStr.match(/reverted with the following reason:\s*(.+?)(?:\.|Contract|$)/i);
      if (reasonMatch && reasonMatch[1]) {
        const reason = reasonMatch[1].trim();
        // Already handled rate limiting above, but check again for variations
        if (reason.includes('rate limit')) {
          return 'The network is currently busy. Please wait a moment and try again.';
        }
        // Return the clean reason without technical details
        return reason.charAt(0).toUpperCase() + reason.slice(1);
      }
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  const handleAddLiquidity = async () => {
    if (!walletConnected || !amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0 || !poolAddress) {
      return;
    }

    setErrorMessage(null);
    setShowProgressModal(true);
    setApprovalStep('none');

    try {
      // Check approvals first before attempting to add liquidity
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const tokenAInfo = TOKENS[finalTokenA];
      const tokenBInfo = TOKENS[finalTokenB];
      const amountAWei = parseUnits(amountA, tokenAInfo.decimals);
      const amountBWei = parseUnits(amountB, tokenBInfo.decimals);

      // Check current allowances
      const [allowanceA, allowanceB] = await Promise.all([
        publicClient.readContract({
          address: tokenAInfo.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [walletAddress!, poolAddress],
        }),
        publicClient.readContract({
          address: tokenBInfo.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [walletAddress!, poolAddress],
        }),
      ]);

      // Check if Token A needs approval
      if (allowanceA < amountAWei) {
        setApprovalStep('approvingA');
        setLastTransactionType('approval'); // Set BEFORE calling approveToken
        setCompletedSteps(new Set()); // Reset completed steps
        setLiquiditySuccess(false); // Ensure liquidity success is false
        approveToken(finalTokenA, poolAddress);
        return; // Wait for approval to complete
      }

      // Check if Token B needs approval
      if (allowanceB < amountBWei) {
        setApprovalStep('approvingB');
        setLastTransactionType('approval'); // Set BEFORE calling approveToken
        setLiquiditySuccess(false); // Ensure liquidity success is false
        // Mark Token A as already approved if we're checking B
        setCompletedSteps(new Set(['approvingA']));
        approveToken(finalTokenB, poolAddress);
        return; // Wait for approval to complete
      }

      // Both tokens approved, proceed with adding liquidity
      // Mark both approvals as completed since tokens are already approved
      setCompletedSteps(new Set(['approvingA', 'approvingB']));
      setApprovalStep('adding');
      setLastTransactionType('liquidity'); // Set BEFORE calling addLiquidity
      setLiquiditySuccess(false); // Reset liquidity success before starting
      await addLiquidity(finalTokenA, finalTokenB, amountA, amountB);
    } catch (err: any) {
      setErrorMessage(formatErrorMessage(err));
      setShowProgressModal(false);
      setApprovalStep('none');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => {
          if (!isPending && !isConfirming) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/30 overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-hide"
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
          {!isPending && !isConfirming && (
            <button
              onClick={onClose}
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
            className="text-xl sm:text-2xl font-bold text-gray-900 mb-6"
          >
            Add Liquidity
          </motion.h3>

          {/* Token Pair Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 p-4 bg-white/60 backdrop-blur-lg rounded-2xl border border-white/40"
            style={{
              boxShadow: `
                inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                0 4px 8px rgba(0, 0, 0, 0.05)
              `,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <TokenLogo token={tokenASymbol} size={40} />
                  <TokenLogo token={tokenBSymbol} size={40} />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {tokenASymbol} / {tokenBSymbol}
                  </div>
                  {isFirstLiquidity ? (
                    <div className="text-xs text-orange-600 font-medium">
                      Setting initial price ratio
                    </div>
                  ) : currentPrice ? (
                    <div className="text-xs text-gray-500">
                      Price: 1 {tokenASymbol} = {currentPrice.toFixed(6)} {tokenBSymbol}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      Loading price...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Amount A */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0">{tokenASymbol}</label>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Balance: {balanceA ? parseFloat(balanceA).toFixed(4) : '0'}
              </span>
            </div>
            <div className="bg-white/60 backdrop-blur-lg rounded-xl p-4 border border-white/40"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                  0 4px 8px rgba(0, 0, 0, 0.05)
                `,
              }}
            >
              <input
                type="number"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0.0"
                step="any"
                className="w-full text-xl font-bold bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
              />
            </div>
          </motion.div>

          {/* Amount B */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0">{tokenBSymbol}</label>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Balance: {balanceB ? parseFloat(balanceB).toFixed(4) : '0'}
              </span>
            </div>
            <div className="bg-white/60 backdrop-blur-lg rounded-xl p-4 border border-white/40"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                  0 4px 8px rgba(0, 0, 0, 0.05)
                `,
              }}
            >
              <input
                type="number"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0.0"
                step="any"
                className="w-full text-xl font-bold bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
              />
            </div>
          </motion.div>

          {/* Info Box for existing pools */}
          {!isFirstLiquidity && currentPrice && amountA && parseFloat(amountA) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4 p-3 bg-blue-50/80 backdrop-blur-sm rounded-xl border border-blue-200"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">Current Pool Price</p>
                  <p className="mt-1">
                    1 {tokenASymbol} = {currentPrice.toFixed(6)} {tokenBSymbol}
                  </p>
                  <p className="mt-1 text-blue-700">
                    Amounts will be added at this ratio.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Info Box for new pools (first liquidity) */}
          {isFirstLiquidity && startingPrice && amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4 p-3 bg-orange-50/80 backdrop-blur-sm rounded-xl border border-orange-200"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-800">
                  <p className="font-medium">Starting Price Ratio</p>
                  <p className="mt-1">
                    1 {tokenASymbol} = {startingPrice.toFixed(6)} {tokenBSymbol}
                  </p>
                  <p className="mt-1 text-orange-700">
                    You're setting the initial price for this pool. Make sure the ratio is correct.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Warning for new pools without both amounts */}
          {isFirstLiquidity && (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4 p-3 bg-yellow-50/80 backdrop-blur-sm rounded-xl border border-yellow-200"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-800">
                  <p className="font-medium">First Liquidity Provider</p>
                  <p className="mt-1">
                    This pool has no liquidity. Set both token amounts to establish the initial price ratio.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {errorMessage && !showProgressModal && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm rounded-xl border border-red-200 flex items-start gap-2"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Error</p>
                <p className="text-xs mt-1">{errorMessage}</p>
              </div>
            </motion.div>
          )}

          {/* Add Liquidity Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={handleAddLiquidity}
            disabled={
              !walletConnected ||
              !isArcTestnet ||
              !amountA ||
              !amountB ||
              parseFloat(amountA) <= 0 ||
              parseFloat(amountB) <= 0 ||
              isPending ||
              isConfirming ||
              (approvalStep !== 'none' && approvalStep !== 'adding')
            }
            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              !walletConnected ||
              !isArcTestnet ||
              !amountA ||
              !amountB ||
              parseFloat(amountA) <= 0 ||
              parseFloat(amountB) <= 0 ||
              isPending ||
              isConfirming ||
              (approvalStep !== 'none' && approvalStep !== 'adding')
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
            }`}
            style={!walletConnected ||
              !isArcTestnet ||
              !amountA ||
              !amountB ||
              parseFloat(amountA) <= 0 ||
              parseFloat(amountB) <= 0 ||
              isPending ||
              isConfirming ||
              (approvalStep !== 'none' && approvalStep !== 'adding') ? {} : {
              boxShadow: `
                inset 0 2px 4px rgba(255, 255, 255, 0.3),
                inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                0 4px 12px rgba(251, 146, 60, 0.4),
                0 2px 4px rgba(0, 0, 0, 0.1)
              `,
            }}
            whileHover={
              !walletConnected ||
              !isArcTestnet ||
              !amountA ||
              !amountB ||
              parseFloat(amountA) <= 0 ||
              parseFloat(amountB) <= 0 ||
              isPending ||
              isConfirming ||
              (approvalStep !== 'none' && approvalStep !== 'adding')
                ? {}
                : { scale: 1.02 }
            }
            whileTap={
              !walletConnected ||
              !isArcTestnet ||
              !amountA ||
              !amountB ||
              parseFloat(amountA) <= 0 ||
              parseFloat(amountB) <= 0 ||
              isPending ||
              isConfirming ||
              (approvalStep !== 'none' && approvalStep !== 'adding')
                ? {}
                : { scale: 0.98 }
            }
          >
            {(isPending || isConfirming) && <Loader2 className="w-5 h-5 animate-spin" />}
            {!walletConnected
              ? 'Connect Wallet'
              : !isArcTestnet
              ? 'Switch to Arc Testnet'
              : !amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0
              ? 'Enter Amounts'
              : approvalStep === 'approvingA'
              ? `Approving ${tokenASymbol}...`
              : approvalStep === 'approvingB'
              ? `Approving ${tokenBSymbol}...`
              : approvalStep === 'adding'
              ? 'Adding Liquidity...'
              : 'Add Liquidity'}
          </motion.button>

          {/* Progress Modal */}
          <AnimatePresence>
            {showProgressModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={(e) => {
                  e.stopPropagation();
                  // Don't close modal if transaction is in progress
                  // Allow closing if process is complete (liquiditySuccess) or no active transactions
                  const canClose = liquiditySuccess || 
                    (!isPending && !isConfirming && 
                     (approvalStep === 'none' || (liquiditySuccess && completedLiquidityHash === hash)));
                  if (canClose) {
                    setShowProgressModal(false);
                    setModalManuallyClosed(true); // Mark as manually closed to prevent reopening
                    setApprovalStep('none');
                    setLiquiditySuccess(false);
                    setErrorMessage(null);
                    setCompletedApprovalStep('none');
                    setCompletedSteps(new Set());
                    setCompletedLiquidityHash(null);
                    setLastTransactionType(null);
                  }
                }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/30 overflow-hidden min-h-[200px]"
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
                  {(liquiditySuccess || 
                    (liquiditySuccess && completedLiquidityHash === hash && !isPending && !isConfirming) ||
                    (!isPending && !isConfirming && approvalStep === 'none')) && (
                    <button
                      onClick={() => {
                    setShowProgressModal(false);
                    setApprovalStep('none');
                    setLiquiditySuccess(false);
                    setErrorMessage(null);
                    setCompletedApprovalStep('none');
                    setCompletedSteps(new Set());
                    setCompletedLiquidityHash(null);
                    setLastTransactionType(null);
                    setModalManuallyClosed(true);
                    setTimeout(() => {
                      setAmountA('');
                      setAmountB('');
                      onClose();
                    }, 300);
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
                    Adding Liquidity
                  </motion.h3>

                  <div className="space-y-4">
                    {/* Step 1: Approve Token A */}
                    {/* Always show if we're in any approval/liquidity flow */}
                    {(approvalStep === 'approvingA' || approvalStep === 'approvingB' || approvalStep === 'adding') && (
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
                            {approvalStep === 'approvingA' && (isPending || isConfirming) ? (
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
                            ) : completedSteps.has('approvingA') || approvalStep !== 'approvingA' ? (
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
                              approvalStep === 'approvingA' && (isPending || isConfirming)
                                ? 'text-orange-600'
                                : completedSteps.has('approvingA') || approvalStep !== 'approvingA'
                                ? 'text-green-600'
                                : 'text-gray-500'
                            }`}>
                              Approve {tokenASymbol}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {approvalStep === 'approvingA' && (isPending || isConfirming) 
                                ? 'Confirm in wallet...' 
                                : completedSteps.has('approvingA') || approvalStep !== 'approvingA'
                                ? 'Completed'
                                : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Approve Token B */}
                    {/* Always show if we're approving B or adding liquidity */}
                    {(approvalStep === 'approvingB' || approvalStep === 'adding') && (
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
                            {approvalStep === 'approvingB' && (isPending || isConfirming) ? (
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
                            ) : completedSteps.has('approvingB') || approvalStep === 'adding' ? (
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
                              approvalStep === 'approvingB' && (isPending || isConfirming)
                                ? 'text-orange-600'
                                : completedSteps.has('approvingB') || approvalStep === 'adding'
                                ? 'text-green-600'
                                : 'text-gray-500'
                            }`}>
                              Approve {tokenBSymbol}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {approvalStep === 'approvingB' && (isPending || isConfirming) 
                                ? 'Confirm in wallet...' 
                                : completedSteps.has('approvingB') || approvalStep === 'adding'
                                ? 'Completed'
                                : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Add Liquidity */}
                    {approvalStep === 'adding' && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
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
                            {approvalStep === 'adding' && (isPending || isConfirming) ? (
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
                            ) : completedSteps.has('adding') || (liquiditySuccess && completedLiquidityHash === hash) ? (
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
                              approvalStep === 'adding' && (isPending || isConfirming)
                                ? 'text-orange-600'
                                : completedSteps.has('adding') || (liquiditySuccess && completedLiquidityHash === hash)
                                ? 'text-green-600'
                                : 'text-gray-500'
                            }`}>
                              Add Liquidity
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {approvalStep === 'adding' && (isPending || isConfirming) 
                                ? 'Confirm in wallet...' 
                                : completedSteps.has('adding') || (liquiditySuccess && completedLiquidityHash === hash)
                                ? 'Success'
                                : 'Pending'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Success Message */}
                    {liquiditySuccess && (
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
                            Liquidity added successfully
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
                            setApprovalStep('none');
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

