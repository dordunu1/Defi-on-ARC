import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownUp, Settings, Info, ChevronDown, AlertCircle, CheckCircle2, Loader2, X, Search, Copy } from 'lucide-react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { useDEX, useTokenBalance, useSwapOutput, useTokenAllowance, usePoolReserves, TOKENS, type TokenSymbol, usePoolAddress, useTokenBalanceByAddress } from '../hooks/useDEX';
import { ERC20_ABI, POOL_ABI } from '../config/abis';
import { parseUnits, type Address, isAddress } from 'viem';
import { getPoolAddress } from '../hooks/useDEX';
import { DEX_CONFIG } from '../config/dex';
import TokenLogo from './TokenLogo';
import { addArcTestnetToWallet } from '../utils/addArcTestnet';
import PriceChart from './PriceChart';
import ActivityTab from './ActivityTab';
import SwapSuccessModal from './SwapSuccessModal';
import SwapActivity from './SwapActivity';

const AVAILABLE_TOKENS: TokenSymbol[] = ['USDC', /* 'EURC', */ 'SRAC', 'RACS', 'SACS', 'KITTY', 'DOGG']; // EURC commented out - liquidity issue

// Custom token interface for ERC20 addresses
interface CustomToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export default function Swap() {
  const { isConnected, address, chainId } = useAccount();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState<TokenSymbol | Address>('USDC');
  const [toToken, setToToken] = useState<TokenSymbol | Address>('SRAC');
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isCalculatingOutput, setIsCalculatingOutput] = useState(false);
  const [showLiquidityInfo, setShowLiquidityInfo] = useState(false);
  
  // Custom tokens state
  const [customTokens, setCustomTokens] = useState<Map<Address, CustomToken>>(new Map());
  const [addressInput, setAddressInput] = useState('');
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [tokenFetchError, setTokenFetchError] = useState<string | null>(null);

  const { swap, approveForSwap, approveRouter, findSwapPath, isPending, isConfirming, isSuccess, error, hash } = useDEX();
  
  // Check if tokens are addresses
  const fromTokenIsAddress = typeof fromToken === 'string' && isAddress(fromToken);
  const toTokenIsAddress = typeof toToken === 'string' && isAddress(toToken);
  const fromTokenCustom = fromTokenIsAddress ? customTokens.get(fromToken as Address) : null;
  const toTokenCustom = toTokenIsAddress ? customTokens.get(toToken as Address) : null;
  
  // Always call hooks unconditionally (React rules) - call both and use the appropriate one
  const fromBalancePredefined = useTokenBalance(fromTokenIsAddress ? null : (fromToken as TokenSymbol));
  const fromBalanceCustom = useTokenBalanceByAddress(
    fromTokenIsAddress && fromTokenCustom ? (fromToken as Address) : undefined,
    fromTokenCustom?.decimals || 18
  );
  const fromBalance = (fromTokenIsAddress && fromTokenCustom ? fromBalanceCustom : fromBalancePredefined) || '0';
  
  const toBalancePredefined = useTokenBalance(toTokenIsAddress ? null : (toToken as TokenSymbol));
  const toBalanceCustom = useTokenBalanceByAddress(
    toTokenIsAddress && toTokenCustom ? (toToken as Address) : undefined,
    toTokenCustom?.decimals || 18
  );
  const toBalance = (toTokenIsAddress && toTokenCustom ? toBalanceCustom : toBalancePredefined) || '0';
  
  const estimatedOutput = useSwapOutput(fromToken as TokenSymbol, toToken as TokenSymbol, fromAmount);
  const publicClient = usePublicClient();
  
  // Fetch token info from ERC20 contract
  const fetchTokenInfo = useCallback(async (tokenAddress: Address): Promise<CustomToken | null> => {
    if (!publicClient) return null;
    
    setIsFetchingToken(true);
    setTokenFetchError(null);
    
    try {
      // Check if we already have this token cached
      if (customTokens.has(tokenAddress)) {
        setIsFetchingToken(false);
        return customTokens.get(tokenAddress) || null;
      }
      
      // Fetch token info from contract
      const [symbol, name, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }) as Promise<string>,
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        }) as Promise<string>,
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }) as Promise<number>,
      ]);
      
      const tokenInfo: CustomToken = {
        address: tokenAddress,
        symbol: symbol || 'UNKNOWN',
        name: name || 'Unknown Token',
        decimals: decimals || 18,
      };
      
      // Cache the token
      setCustomTokens(prev => new Map(prev).set(tokenAddress, tokenInfo));
      setIsFetchingToken(false);
      return tokenInfo;
    } catch (err: any) {
      setIsFetchingToken(false);
      setTokenFetchError(err?.message || 'Failed to fetch token info. Make sure the address is a valid ERC20 token on Arc Testnet.');
      return null;
    }
  }, [publicClient, customTokens]);
  
  // Handle address input and fetch token automatically
  const handleAddressInput = useCallback(async (input: string) => {
    setAddressInput(input);
    setTokenFetchError(null);
    
    // Auto-fetch when valid address is detected
    if (input && isAddress(input)) {
      const tokenInfo = await fetchTokenInfo(input as Address);
      if (tokenInfo) {
        // Auto-select the token after fetching
        if (showTokenSelector === 'from') {
          setFromToken(tokenInfo.address);
        } else if (showTokenSelector === 'to') {
          setToToken(tokenInfo.address);
        }
        setAddressInput('');
        setShowTokenSelector(null);
      }
    }
  }, [fetchTokenInfo, showTokenSelector]);
  
  // Get token display info (symbol or custom token symbol)
  const getTokenDisplay = useCallback((token: TokenSymbol | Address): { symbol: string; name?: string; isCustom: boolean } => {
    if (typeof token === 'string' && isAddress(token)) {
      const customToken = customTokens.get(token as Address);
      if (customToken) {
        return { symbol: customToken.symbol, name: customToken.name, isCustom: true };
      }
      return { symbol: `${token.slice(0, 6)}...${token.slice(-4)}`, isCustom: true };
    }
    return { symbol: token, isCustom: false };
  }, [customTokens]);
  
  // Get token address (works with both TokenSymbol and Address)
  const getTokenAddress = useCallback((token: TokenSymbol | Address): Address | undefined => {
    if (typeof token === 'string' && isAddress(token)) {
      return token as Address;
    }
    return TOKENS[token as TokenSymbol]?.address;
  }, []);
  
  // Get token decimals (works with both TokenSymbol and Address)
  const getTokenDecimals = useCallback((token: TokenSymbol | Address): number => {
    if (typeof token === 'string' && isAddress(token)) {
      const customToken = customTokens.get(token as Address);
      return customToken?.decimals || 18;
    }
    return TOKENS[token as TokenSymbol]?.decimals || 18;
  }, [customTokens]);
  
  // Get pool address using the hook
  // For custom tokens (addresses), we need to handle them differently
  const fromTokenForPool = typeof fromToken === 'string' && isAddress(fromToken) 
    ? (customTokens.get(fromToken as Address)?.symbol as TokenSymbol || fromToken as TokenSymbol)
    : fromToken as TokenSymbol;
  const toTokenForPool = typeof toToken === 'string' && isAddress(toToken)
    ? (customTokens.get(toToken as Address)?.symbol as TokenSymbol || toToken as TokenSymbol)
    : toToken as TokenSymbol;
  const poolAddress = usePoolAddress(fromTokenForPool, toTokenForPool);
  
  // Get swap path for multi-hop swaps (to display route in review modal)
  const [swapPath, setSwapPath] = useState<TokenSymbol[] | null>(null);
  
  useEffect(() => {
    const fetchSwapPath = async () => {
      if (!poolAddress && DEX_CONFIG.ROUTER_ADDRESS && publicClient) {
        try {
          const path = await findSwapPath(fromTokenForPool, toTokenForPool);
          // Convert addresses to token symbols
          const pathSymbols: TokenSymbol[] = [];
          for (const addr of path) {
            const token = Object.entries(TOKENS).find(([_, info]) => 
              info.address.toLowerCase() === (addr as string).toLowerCase()
            )?.[0] as TokenSymbol | undefined;
            if (token) pathSymbols.push(token);
          }
          setSwapPath(pathSymbols.length > 0 ? pathSymbols : null);
        } catch (error) {
          setSwapPath(null);
        }
      } else {
        setSwapPath(null); // Direct swap, no path needed
      }
    };
    
    if (fromToken && toToken && !poolAddress) {
      fetchSwapPath();
    } else {
      setSwapPath(null);
    }
  }, [fromToken, toToken, poolAddress, publicClient, findSwapPath]);
  
  const [swapStep, setSwapStep] = useState<'none' | 'approving' | 'swapping'>('none');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvalCompleted, setApprovalCompleted] = useState(false);
  const [swapHash, setSwapHash] = useState<`0x${string}` | null>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [swapConfirmed, setSwapConfirmed] = useState(false);
  const [swapStartTime, setSwapStartTime] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successShownForHash, setSuccessShownForHash] = useState<`0x${string}` | null>(null);
  const [swapTransactionStarted, setSwapTransactionStarted] = useState(false);
  const [hasBeenPendingForCurrentHash, setHasBeenPendingForCurrentHash] = useState(false);
  
  // Check if on Arc Testnet
  const isArcTestnet = chainId === 5042002;

  // Format error message
  const formatSwapError = (err: any): string => {
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
    
    // Pool errors (but allow Router swaps)
    if (errorStr.includes('Pool not found') || errorStr.includes('pool')) {
      // Check if Router can handle this swap
      if (DEX_CONFIG.ROUTER_ADDRESS && !poolAddress && estimatedOutput && estimatedOutput !== '0') {
        return 'Swap will use Router for multi-hop path.';
      }
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

  // Format output amount with appropriate decimals
  const formatOutputAmount = (amount: string, token: TokenSymbol | Address) => {
    if (!amount || amount === '0') return '0';
    const num = parseFloat(amount);
    const decimals = getTokenDecimals(token);
    if (num === 0) return '0';
    
    const tokenDecimals = decimals;
    // For 18 decimals: show up to 6 decimal places if < 1, otherwise 4
    // For 6 decimals: show up to 4 decimal places if < 1, otherwise 2
    if (num < 1) {
      return num.toFixed(Math.min(tokenDecimals, 6));
    } else if (num < 100) {
      return num.toFixed(4);
    } else {
      return num.toFixed(2);
    }
  };

  // Close token selector and liquidity info when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTokenSelector) {
        setShowTokenSelector(null);
      }
      // Close liquidity info on outside click (mobile)
      if (showLiquidityInfo && window.innerWidth < 768) {
        setShowLiquidityInfo(false);
      }
    };
    if (showTokenSelector || showLiquidityInfo) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTokenSelector, showLiquidityInfo]);

  // Get pool reserves for price calculations
  const poolReserves = usePoolReserves(fromToken, toToken);

  // Calculate exchange rate (spot price)
  const exchangeRate = useMemo(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !toAmount || parseFloat(toAmount) <= 0) return null;
    const rate = parseFloat(toAmount) / parseFloat(fromAmount);
    return rate;
  }, [fromAmount, toAmount]);

  // Get pool's actual token addresses to correctly map reserves
  const { data: poolTokenA } = useReadContract({
    address: poolAddress || undefined,
    abi: POOL_ABI,
    functionName: 'tokenA',
    query: { enabled: !!poolAddress },
  });

  const { data: poolTokenB } = useReadContract({
    address: poolAddress || undefined,
    abi: POOL_ABI,
    functionName: 'tokenB',
    query: { enabled: !!poolAddress },
  });

  // Calculate price impact
  const priceImpact = useMemo(() => {
    if (!poolReserves.reserveA || !poolReserves.reserveB || !fromAmount || parseFloat(fromAmount) <= 0 || !poolTokenA || !poolTokenB) return null;
    
    const reserveA = parseFloat(poolReserves.reserveA);
    const reserveB = parseFloat(poolReserves.reserveB);
    
    // CRITICAL: Match reserves based on pool's actual token order
    // poolReserves.reserveA = pool's tokenA balance, reserveB = pool's tokenB balance
    const fromTokenAddr = getTokenAddress(fromToken)?.toLowerCase();
    if (!fromTokenAddr) return null;
    
    const poolTokenAAddr = (poolTokenA as string).toLowerCase();
    const poolTokenBAddr = (poolTokenB as string).toLowerCase();
    
    // Determine if user is swapping pool's tokenA or tokenB
    const isSwappingPoolTokenA = fromTokenAddr === poolTokenAAddr;
    
    if (!isSwappingPoolTokenA && fromTokenAddr !== poolTokenBAddr) {
      return null; // Token mismatch
    }
    
    // Map reserves correctly: reserveIn = what user is putting in, reserveOut = what user is getting
    const reserveIn = isSwappingPoolTokenA ? reserveA : reserveB;
    const reserveOut = isSwappingPoolTokenA ? reserveB : reserveA;
    
    if (reserveIn === 0 || reserveOut === 0) return null;
    
    // Calculate spot price before swap (price in terms of output token per input token)
    const spotPrice = reserveOut / reserveIn;
    
    // Calculate price after swap using Uniswap V2 constant product formula with fee
    const amountIn = parseFloat(fromAmount);
    // Fee is 0.3% (30 bps) - after fee: 9970/10000 = 0.997
    const amountInWithFee = amountIn * 0.997;
    const newReserveIn = reserveIn + amountInWithFee;
    // Constant product: k = reserveIn * reserveOut (before and after swap)
    const k = reserveIn * reserveOut;
    const newReserveOut = k / newReserveIn;
    const amountOut = reserveOut - newReserveOut;
    
    if (amountOut <= 0) return null;
    
    // Calculate execution price (average price user gets)
    const executionPrice = amountOut / amountIn;
    
    // Price impact = percentage difference between execution price and spot price
    // Negative impact means user gets less favorable price
    const impact = ((spotPrice - executionPrice) / spotPrice) * 100;
    
    return impact > 0 ? impact : 0;
  }, [poolReserves, fromAmount, fromToken, poolTokenA, poolTokenB]);

  // Calculate minimum receive amount (with slippage)
  const minReceive = useMemo(() => {
    if (!toAmount || parseFloat(toAmount) <= 0) return '0';
    const slippagePercent = parseFloat(slippage) / 100;
    const min = parseFloat(toAmount) * (1 - slippagePercent);
    return min.toFixed(6);
  }, [toAmount, slippage]);

  // Update output amount when input changes with loading state
  useEffect(() => {
    if (fromAmount && fromAmount !== '' && parseFloat(fromAmount) > 0) {
      setIsCalculatingOutput(true);
      // Small delay to show loading
      const timer = setTimeout(() => {
        if (estimatedOutput && estimatedOutput !== '0') {
          const formatted = formatOutputAmount(estimatedOutput, toToken);
          setToAmount(formatted);
        }
        setIsCalculatingOutput(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setToAmount('');
      setIsCalculatingOutput(false);
    }
  }, [fromAmount, estimatedOutput, toToken]);

  // Check if approval is needed (for direct pool or Router)
  const fromTokenDecimals = getTokenDecimals(fromToken);
  const fromAmountWei = fromAmount && !isNaN(parseFloat(fromAmount)) && parseFloat(fromAmount) > 0
    ? parseUnits(fromAmount, fromTokenDecimals)
    : 0n;
  
  // Get actual token address for allowance checks
  const fromTokenAddress = getTokenAddress(fromToken);
  
  // Check allowance for direct pool
  const poolAllowance = fromTokenAddress ? useTokenAllowance(fromTokenAddress, poolAddress) : 0n;
  
  // Check allowance for Router (if no direct pool)
  const routerAllowance = fromTokenAddress ? useTokenAllowance(fromTokenAddress, DEX_CONFIG.ROUTER_ADDRESS || null) : 0n;
  
  // Determine which approval is needed
  const needsPoolApproval = poolAddress && poolAllowance < fromAmountWei;
  const needsRouterApproval = !poolAddress && DEX_CONFIG.ROUTER_ADDRESS && routerAllowance < fromAmountWei;
  const needsApproval = needsPoolApproval || needsRouterApproval;

  // Track when approval completes and auto-proceed to swap
  useEffect(() => {
    if (isSuccess && swapStep === 'approving' && !approvalCompleted && address && publicClient) {
      const proceedToSwap = async () => {
        try {
          // Mark approval as completed to prevent re-triggering
          setApprovalCompleted(true);
          
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check fresh allowance (for pool or Router, depending on which was approved)
          const spender = poolAddress || DEX_CONFIG.ROUTER_ADDRESS;
          if (!spender) {
            throw new Error('No spender address found');
          }
          
          const fromTokenAddr = getTokenAddress(fromToken);
          if (!fromTokenAddr) {
            throw new Error('Invalid token address');
          }
          
          const freshAllowance = await publicClient.readContract({
            address: fromTokenAddr,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, spender],
          });

          if (freshAllowance >= fromAmountWei) {
            // Approval confirmed, proceed to swap
            setSwapStep('swapping');
            const slippageValue = parseFloat(slippage);
            await swap(fromTokenForPool, toTokenForPool, fromAmount, slippageValue);
          } else {
            throw new Error('Approval incomplete');
          }
        } catch (err: any) {
          setErrorMessage(formatSwapError(err));
          setSwapStep('none');
          setShowProgressModal(false);
          setApprovalCompleted(false);
        }
      };

      proceedToSwap();
    }
  }, [isSuccess, swapStep, approvalCompleted, poolAddress, address, publicClient, fromToken, toToken, fromAmount, fromAmountWei, getTokenAddress, swap, slippage]);

  // Track swap transaction hash when it's initiated
  // CRITICAL: This effect only runs when hash changes to a NEW transaction
  useEffect(() => {
    if (hash && swapStep === 'swapping') {
      // Only update if hash changed (new transaction) - this means a NEW swap transaction started
      if (!swapHash || swapHash !== hash) {
        // This is a NEW transaction hash - reset everything for this new swap
        setSwapHash(hash);
        setSwapStartTime(Date.now());
        setSwapConfirmed(false);
        setShowSuccessModal(false); // Ensure success modal is closed for new transaction
        setSuccessShownForHash(null); // Reset success tracking for new transaction
        setSwapTransactionStarted(true); // Mark that we've started a new swap transaction
        setHasBeenPendingForCurrentHash(false); // Reset pending state tracking for new transaction
      }
    }
  }, [hash, swapStep]); // Remove swapHash from deps to detect hash changes properly

  // Auto-confirm swap success after 5 seconds if we have a hash (since chain is fast)
  useEffect(() => {
    if (swapHash && swapStep === 'swapping' && !swapConfirmed && swapStartTime) {
      const elapsed = Date.now() - swapStartTime;
      const remaining = Math.max(0, 5000 - elapsed); // 5 seconds total
      
      if (remaining > 0) {
        const timeoutId = setTimeout(() => {
          // After 5 seconds, mark as confirmed
          setSwapConfirmed(true);
        }, remaining);
        
        return () => clearTimeout(timeoutId);
      } else {
        // Already past 5 seconds
        setSwapConfirmed(true);
      }
    }
  }, [swapHash, swapStep, swapConfirmed, swapStartTime]);

  // Track when we've been pending for the current hash (prevents stale isSuccess from triggering)
  useEffect(() => {
    if (swapStep === 'swapping' && swapHash && hash && swapHash === hash) {
      if (isPending || isConfirming) {
        // Mark that we've been through pending state for this hash
        setHasBeenPendingForCurrentHash(true);
      }
    } else {
      // Reset when not swapping or hash changes
      setHasBeenPendingForCurrentHash(false);
    }
  }, [isPending, isConfirming, swapStep, swapHash, hash]);

  // Track swap progress and errors
  useEffect(() => {
    // Only show modal and track progress during active steps
    if (swapStep !== 'none') {
      if (isPending || isConfirming) {
        // Transaction is in progress - show progress modal
        if (!showProgressModal) {
          setShowProgressModal(true);
        }
      } else if (
        swapStep === 'swapping' && 
        swapHash && 
        hash && 
        swapHash === hash && 
        swapTransactionStarted && // CRITICAL: Only show if we actually started this transaction
        hasBeenPendingForCurrentHash && // CRITICAL: Must have gone through pending state for this hash
        isSuccess && 
        !isPending && 
        !isConfirming && 
        !showSuccessModal && 
        successShownForHash !== hash
      ) {
        // Show success modal only after actual on-chain confirmation
        // isSuccess from useWaitForTransactionReceipt ensures transaction is confirmed
        // Only show if: we're in swapping step, have a hash, hash matches current transaction, 
        // we started this transaction, we've been through pending state, isSuccess is true, and we haven't shown success for this hash yet
        setShowProgressModal(false); // Close progress modal first
        setShowSuccessModal(true); // Show success modal
        setSuccessShownForHash(hash); // Mark that we've shown success for this hash
      } else if (swapStep === 'approving' && !isPending && !isConfirming && !approvalCompleted) {
        // Approval completed but hasn't proceeded to swap yet - keep modal open
        // This handles the gap between approval completion and swap initiation
      } else if (error && swapStep === 'swapping') {
        // Only show error if we're actually in the swapping step
        const errorMsg = formatSwapError(error);
        setErrorMessage(errorMsg);
        const timeoutId = setTimeout(() => {
          setShowProgressModal(false);
          setSwapStep('none');
          setApprovalCompleted(false);
          setSwapHash(null);
          setSwapConfirmed(false);
          setSwapStartTime(null);
          setShowSuccessModal(false); // Reset success modal on error
          setSuccessShownForHash(null); // Reset success tracking on error
          setSwapTransactionStarted(false); // Reset transaction started flag on error
          setHasBeenPendingForCurrentHash(false); // Reset pending state tracking on error
        }, 3000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isPending, isConfirming, isSuccess, error, swapStep, showProgressModal, swapHash, showSuccessModal, hash, approvalCompleted, successShownForHash, swapTransactionStarted, hasBeenPendingForCurrentHash]);

  const handleAmountChange = (value: string, type: 'from' | 'to') => {
    if (type === 'from') {
      setFromAmount(value);
    } else {
      setToAmount(value);
    }
  };

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleSwapClick = async () => {
    // If not connected, let RainbowKit handle connection
    if (!isConnected) {
      return;
    }

    // If not on Arc Testnet, try to add/switch to it
    if (!isArcTestnet) {
      setIsSwitchingNetwork(true);
      setErrorMessage(null);
      try {
        // Try to add Arc Testnet to wallet first (this handles adding and switching)
        await addArcTestnetToWallet();
        // The addArcTestnetToWallet function already switches to the chain
        // If we still need to use wagmi's switchChain, wait a moment first
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        const errorMsg = error.message || 'Failed to add Arc Testnet to wallet. Please add it manually in MetaMask settings.';
        setErrorMessage(errorMsg);
      } finally {
        setIsSwitchingNetwork(false);
      }
      return;
    }

    // If on correct network, proceed with swap
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;
    if (!publicClient || !address) {
      setErrorMessage('Wallet not connected');
      return;
    }
    
    // Check if we have a direct pool OR Router can handle it
    if (!poolAddress && (!DEX_CONFIG.ROUTER_ADDRESS || !estimatedOutput || estimatedOutput === '0')) {
      setErrorMessage('Pool not found. Please create the pool first or ensure Router is configured.');
      return;
    }
    
    // Show review modal first
    setShowReviewModal(true);
  };

  const handleConfirmSwap = async () => {
    if (!isConnected || !fromAmount || parseFloat(fromAmount) <= 0) return;
    if (!publicClient || !address) {
      setErrorMessage('Wallet not connected');
      setShowReviewModal(false);
      return;
    }
    
    // Check if we have a direct pool OR Router can handle it
    if (!poolAddress && (!DEX_CONFIG.ROUTER_ADDRESS || !estimatedOutput || estimatedOutput === '0')) {
      setErrorMessage('Pool not found. Please create the pool first or ensure Router is configured.');
      setShowReviewModal(false);
      return;
    }
    
    setShowReviewModal(false);
    
    try {
      // Reset ALL state for new swap attempt
      setErrorMessage(null);
      setSwapStep('none'); // Reset swap step first
      setApprovalCompleted(false);
      setSwapHash(null);
      setSwapConfirmed(false);
      setSwapStartTime(null);
      setShowSuccessModal(false); // CRITICAL: Reset success modal state
      setSuccessShownForHash(null); // CRITICAL: Reset success tracking
      setSwapTransactionStarted(false); // CRITICAL: Reset transaction started flag
      setHasBeenPendingForCurrentHash(false); // CRITICAL: Reset pending state tracking
      setShowProgressModal(false); // Close any existing progress modal
      
      // Small delay to ensure state is fully reset before starting new transaction
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if approval is needed
      if (needsApproval) {
        // Need approval first
        // CRITICAL: Ensure swapTransactionStarted is false during approval
        setSwapTransactionStarted(false);
        setSwapStep('approving');
        setShowProgressModal(true);
        
        // Approve Router if no direct pool, otherwise approve pool
        // Use actual token address
        if (needsRouterApproval && fromTokenAddress) {
          approveRouter(fromTokenAddress);
        } else if (poolAddress && fromTokenAddress) {
          approveForSwap(fromTokenAddress, poolAddress);
        }
      } else {
        // Already approved, proceed directly to swap
        // CRITICAL: Reset transaction started flag before swap
        setSwapTransactionStarted(false);
        setSwapStep('swapping');
        setShowProgressModal(true);
        setApprovalCompleted(true); // Skip approval tracking
        const slippageValue = parseFloat(slippage);
        await swap(fromTokenForPool, toTokenForPool, fromAmount, slippageValue);
        // Note: swapTransactionStarted will be set to true when hash is captured in useEffect
      }
    } catch (err: any) {
      const errorMsg = formatSwapError(err);
      setErrorMessage(errorMsg);
      setShowProgressModal(false);
      setSwapStep('none');
      setApprovalCompleted(false);
      setSwapHash(null);
      setSwapConfirmed(false);
      setSwapStartTime(null);
      setShowSuccessModal(false); // Reset success modal on error
    }
  };

  const selectToken = (token: TokenSymbol | Address) => {
    if (showTokenSelector === 'from') {
      if (token === toToken) {
        // Swap tokens if selecting the same as 'to'
        setToToken(fromToken);
      }
      setFromToken(token);
    } else if (showTokenSelector === 'to') {
      if (token === fromToken) {
        // Swap tokens if selecting the same as 'from'
        setFromToken(toToken);
      }
      setToToken(token);
    }
    setShowTokenSelector(null);
    setAddressInput('');
    setTokenFetchError(null);
  };

  // Token item component for predefined tokens
  const TokenItem = ({ token, isSelected, onSelect }: { token: TokenSymbol; isSelected: boolean; onSelect: () => void }) => {
    const tokenBalance = useTokenBalance(token);
    return (
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        whileHover={{ scale: 1.02, x: 4 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 rounded-lg ${
          isSelected ? 'bg-orange-50' : ''
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <TokenLogo token={token} size={32} className="flex-shrink-0" />
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="font-semibold text-gray-900">{token}</span>
            {TOKENS[token] && (
              <span className="text-xs text-gray-500">{TOKENS[token].address.slice(0, 6)}...{TOKENS[token].address.slice(-4)}</span>
            )}
          </div>
        </div>
        {isConnected && parseFloat(tokenBalance) > 0 && (
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
            {parseFloat(tokenBalance).toFixed(4)}
          </span>
        )}
      </motion.button>
    );
  };

  // Custom token item component
  const CustomTokenItem = ({ token, isSelected, onSelect }: { token: CustomToken; isSelected: boolean; onSelect: () => void }) => {
    const tokenBalance = useTokenBalanceByAddress(token.address, token.decimals);
    return (
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        whileHover={{ scale: 1.02, x: 4 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 rounded-lg ${
          isSelected ? 'bg-orange-50' : ''
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <TokenLogo token={token.symbol} size={32} className="flex-shrink-0" address={token.address} />
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="font-semibold text-gray-900 truncate w-full">{token.symbol}</span>
            <span className="text-xs text-gray-500 truncate w-full">{token.name}</span>
            <span className="text-xs text-gray-400 font-mono">{token.address.slice(0, 6)}...{token.address.slice(-4)}</span>
          </div>
        </div>
        {isConnected && parseFloat(tokenBalance) > 0 && (
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
            {parseFloat(tokenBalance).toFixed(4)}
          </span>
        )}
      </motion.button>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Swap Modal - Left Side */}
        <motion.div
          className="bg-white rounded-3xl p-6 md:p-8 border border-orange-200 shadow-xl relative flex-1 lg:max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            boxShadow: `
              0 0 20px rgba(251, 146, 60, 0.15),
              0 0 40px rgba(251, 146, 60, 0.1),
              0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06),
              inset 0 1px 0 rgba(255, 255, 255, 0.9)
            `
          }}
        >

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 relative z-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">Swap</h2>
            <p className="text-sm md:text-base text-gray-600 flex items-center gap-2">
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">Arc Testnet Only</span>
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 sm:p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all self-start sm:self-auto"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 relative z-10"
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slippage Tolerance (%)
            </label>
            <div className="flex flex-wrap gap-2">
              {['0.1', '0.5', '1.0'].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`flex-1 min-w-[60px] py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    slippage === val
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {val}%
                </button>
              ))}
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-20 px-2 py-2 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm text-center"
                placeholder="Custom"
                step="0.1"
                min="0"
              />
            </div>
          </motion.div>
        )}

        {/* From Token */}
        <div className="mb-4 relative">
          <div className="bg-orange-50 rounded-2xl p-3 sm:p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">From</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Balance: {parseFloat(fromBalance).toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => handleAmountChange(e.target.value, 'from')}
                  placeholder="0.0"
                  className="w-full text-2xl md:text-3xl lg:text-4xl font-bold bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
                />
              </div>
              <div className="relative">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTokenSelector(showTokenSelector === 'from' ? null : 'from');
                  }}
                  className="flex items-center justify-between sm:justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-xl hover:bg-gray-50 transition-all border border-gray-200 w-full sm:w-auto"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    <TokenLogo 
                      token={typeof fromToken === 'string' && isAddress(fromToken) ? getTokenDisplay(fromToken).symbol : fromToken} 
                      size={32} 
                      className="flex-shrink-0"
                      address={typeof fromToken === 'string' && isAddress(fromToken) ? fromToken : undefined}
                    />
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">{getTokenDisplay(fromToken).symbol}</span>
                      {getTokenDisplay(fromToken).name && (
                        <span className="text-xs text-gray-500">{getTokenDisplay(fromToken).name}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
                </motion.button>
                <AnimatePresence>
                  {showTokenSelector === 'from' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-[100] min-w-[400px] w-full sm:w-auto max-h-[600px] overflow-hidden flex flex-col"
                    >
                      {/* Address Input Section */}
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Search className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Paste ERC20 Address</span>
                        </div>
                        <input
                          type="text"
                          value={addressInput}
                          onChange={(e) => handleAddressInput(e.target.value)}
                          placeholder="0x..."
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {isFetchingToken && (
                          <div className="flex items-center gap-2 mt-2">
                            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                            <span className="text-xs text-gray-500">Fetching token info...</span>
                          </div>
                        )}
                        {tokenFetchError && (
                          <p className="text-xs text-red-500 mt-2">{tokenFetchError}</p>
                        )}
                      </div>
                      
                      {/* Token List */}
                      <div className="overflow-y-auto max-h-[400px] scrollbar-hide">
                        {/* Predefined Tokens */}
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">Popular Tokens</p>
                          {AVAILABLE_TOKENS.map((token) => (
                            <TokenItem
                              key={token}
                              token={token}
                              isSelected={fromToken === token}
                              onSelect={() => selectToken(token)}
                            />
                          ))}
                        </div>
                        
                        {/* Custom Tokens */}
                        {Array.from(customTokens.values()).length > 0 && (
                          <div className="p-2 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">Custom Tokens</p>
                            {Array.from(customTokens.values()).map((token) => (
                              <CustomTokenItem
                                key={token.address}
                                token={token}
                                isSelected={fromToken === token.address}
                                onSelect={() => selectToken(token.address)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center relative z-20 my-2">
          <motion.button
            onClick={swapTokens}
            className="p-3 bg-white rounded-full border-4 border-white shadow-lg hover:shadow-xl transition-all relative z-10"
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            style={{
              boxShadow: `
                0 0 20px rgba(251, 146, 60, 0.2),
                0 4px 6px -1px rgba(0, 0, 0, 0.1),
                0 2px 4px -1px rgba(0, 0, 0, 0.06)
              `
            }}
          >
            <ArrowDownUp className="w-5 h-5 text-gray-700" />
          </motion.button>
        </div>

        {/* To Token */}
        <div className="mb-6 relative">
          <div className="bg-orange-50 rounded-2xl p-3 sm:p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">To</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Balance: {parseFloat(toBalance).toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={toAmount}
                  onChange={(e) => handleAmountChange(e.target.value, 'to')}
                  placeholder="0.0"
                  className="w-full text-2xl md:text-3xl lg:text-4xl font-bold bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
                  readOnly
                />
              </div>
              <div className="relative">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTokenSelector(showTokenSelector === 'to' ? null : 'to');
                  }}
                  className="flex items-center justify-between sm:justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-xl hover:bg-gray-50 transition-all border border-gray-200 w-full sm:w-auto"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    <TokenLogo 
                      token={typeof toToken === 'string' && isAddress(toToken) ? getTokenDisplay(toToken).symbol : toToken} 
                      size={32} 
                      className="flex-shrink-0"
                      address={typeof toToken === 'string' && isAddress(toToken) ? toToken : undefined}
                    />
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">{getTokenDisplay(toToken).symbol}</span>
                      {getTokenDisplay(toToken).name && (
                        <span className="text-xs text-gray-500">{getTokenDisplay(toToken).name}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
                </motion.button>
                <AnimatePresence>
                  {showTokenSelector === 'to' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-[100] min-w-[400px] w-full sm:w-auto max-h-[600px] overflow-hidden flex flex-col"
                    >
                      {/* Address Input Section */}
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Search className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Paste ERC20 Address</span>
                        </div>
                        <input
                          type="text"
                          value={addressInput}
                          onChange={(e) => handleAddressInput(e.target.value)}
                          placeholder="0x..."
                          className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {isFetchingToken && (
                          <div className="flex items-center gap-2 mt-2">
                            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                            <span className="text-xs text-gray-500">Fetching token info...</span>
                          </div>
                        )}
                        {tokenFetchError && (
                          <p className="text-xs text-red-500 mt-2">{tokenFetchError}</p>
                        )}
                      </div>
                      
                      {/* Token List */}
                      <div className="overflow-y-auto max-h-[400px] scrollbar-hide">
                        {/* Predefined Tokens */}
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">Popular Tokens</p>
                          {AVAILABLE_TOKENS.map((token) => (
                            <TokenItem
                              key={token}
                              token={token}
                              isSelected={toToken === token}
                              onSelect={() => selectToken(token)}
                            />
                          ))}
                        </div>
                        
                        {/* Custom Tokens */}
                        {Array.from(customTokens.values()).length > 0 && (
                          <div className="p-2 border-t border-gray-200">
                            <p className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">Custom Tokens</p>
                            {Array.from(customTokens.values()).map((token) => (
                              <CustomTokenItem
                                key={token.address}
                                token={token}
                                isSelected={toToken === token.address}
                                onSelect={() => selectToken(token.address)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Details */}
        {fromAmount && toAmount && parseFloat(fromAmount) > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 space-y-2"
          >
            {/* Exchange Rate */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Rate</span>
                </div>
                <span className="font-medium text-gray-900 break-all sm:break-normal">
                  {exchangeRate ? `1 ${fromToken} = ${exchangeRate.toFixed(6)} ${toToken}` : 'Calculating...'}
                </span>
              </div>
            </div>
            
            {/* Price Impact */}
            {priceImpact !== null && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>Price impact</span>
                  </div>
                  <span className={`font-medium ${
                    priceImpact > 5 ? 'text-red-600' : priceImpact > 1 ? 'text-yellow-600' : 'text-gray-900'
                  }`}>
                    {priceImpact.toFixed(3)}%
                  </span>
                </div>
              </div>
            )}

            {/* Max Slippage */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  <span>Max slippage</span>
                </div>
                <span className="font-medium text-gray-900">
                  {slippage}%
                </span>
              </div>
            </div>

            {/* Minimum Receive */}
            {minReceive && parseFloat(minReceive) > 0 && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>Receive at least</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {minReceive} {toToken}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Warning for wrong network */}
        {isConnected && !isArcTestnet && (
          <div className="mb-4 p-3 bg-red-50/80 rounded-xl border border-red-200/50 flex items-start gap-2 relative z-10">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Wrong Network</p>
              <p className="text-xs mt-1">Please switch to Arc Testnet to use this DEX</p>
            </div>
          </div>
        )}

        {/* Warning for unconnected wallet */}
        {!isConnected && (
          <div className="mb-4 p-3 bg-yellow-50/80 rounded-xl border border-yellow-200/50 flex items-start gap-2 relative z-10">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Connect Wallet</p>
              <p className="text-xs mt-1">Connect your wallet to start swapping tokens</p>
            </div>
          </div>
        )}

        {/* Success Message removed - now using SwapSuccessModal component */}

        {/* Error Message - Only show when not in modal */}
        {errorMessage && !showProgressModal && (
          <div className="mb-4 p-3 bg-red-50/80 rounded-xl border border-red-200/50 flex items-start gap-2 relative z-10">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Transaction Failed</p>
              <p className="text-xs mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <motion.button
          onClick={handleSwapClick}
          disabled={!isConnected || (!isArcTestnet && !isSwitchingNetwork) || !fromAmount || parseFloat(fromAmount) <= 0 || isPending || isConfirming || isCalculatingOutput || isSwitchingNetwork}
          className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 relative z-0 flex items-center justify-center gap-2 ${
            !isConnected || (!isArcTestnet && !isSwitchingNetwork) || !fromAmount || parseFloat(fromAmount) <= 0 || isPending || isConfirming || isCalculatingOutput || isSwitchingNetwork
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg active:scale-95'
          }`}
          whileHover={!isConnected || (!isArcTestnet && !isSwitchingNetwork) || !fromAmount || parseFloat(fromAmount) <= 0 || isPending || isConfirming || isCalculatingOutput || isSwitchingNetwork ? {} : { scale: 1.02 }}
          whileTap={!isConnected || (!isArcTestnet && !isSwitchingNetwork) || !fromAmount || parseFloat(fromAmount) <= 0 || isPending || isConfirming || isCalculatingOutput || isSwitchingNetwork ? {} : { scale: 0.98 }}
        >
          {(isPending || isConfirming || isCalculatingOutput || isSwitchingNetwork) && <Loader2 className="w-5 h-5 animate-spin" />}
          {!isConnected
            ? 'Connect Wallet'
            : isSwitchingNetwork
            ? 'Adding Arc Testnet...'
            : !isArcTestnet
            ? 'Add Arc Testnet'
            : !fromAmount || parseFloat(fromAmount) <= 0
            ? 'Enter Amount'
            : isCalculatingOutput
            ? 'Calculating...'
            : isPending || isConfirming
            ? 'Processing...'
            : `Swap ${fromToken} for ${toToken}`}
        </motion.button>

        {/* Liquidity Info Icon with Tooltip */}
        <div className="mt-4 flex items-center justify-center relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLiquidityInfo(!showLiquidityInfo);
            }}
            className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors relative z-10 md:group"
            onMouseEnter={() => {
              setShowLiquidityInfo(true);
            }}
            onMouseLeave={() => {
              // Only auto-hide on desktop hover leave, not on mobile
              if (window.matchMedia('(min-width: 768px)').matches) {
                setShowLiquidityInfo(false);
              }
            }}
          >
            <Info className="w-4 h-4" />
            <span className="text-xs font-medium">About liquidity and price impact</span>
          </button>
          
          {/* Tooltip/Popover */}
          <AnimatePresence>
            {showLiquidityInfo && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-80 sm:w-96 z-50 pointer-events-auto md:group-hover:block"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 mb-2">Low Liquidity Notice</p>
                      <p className="text-xs text-yellow-700 leading-relaxed">
                        Pools may have limited liquidity, which could result in higher price impact and price volatility during swaps. 
                        Please review the price impact before confirming your transaction. Consider adding liquidity to help improve pool stability.
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLiquidityInfo(false);
                      }}
                      className="text-yellow-600 hover:text-yellow-800 transition-colors flex-shrink-0 md:hidden"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Review Modal */}
        <AnimatePresence>
          {showReviewModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowReviewModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
                style={{
                  boxShadow: `
                    0 0 30px rgba(251, 146, 60, 0.25),
                    0 0 60px rgba(251, 146, 60, 0.15),
                    0 10px 25px -5px rgba(0, 0, 0, 0.1),
                    0 4px 6px -2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.9)
                  `
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Review swap</h3>
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* You Pay */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">You pay</p>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-gray-900">{fromAmount} {getTokenDisplay(fromToken).symbol}</p>
                      <TokenLogo 
                        token={typeof fromToken === 'string' && isAddress(fromToken) ? getTokenDisplay(fromToken).symbol : fromToken} 
                        size={40}
                        address={typeof fromToken === 'string' && isAddress(fromToken) ? fromToken : undefined}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                      Balance: {parseFloat(fromBalance).toFixed(4)} {getTokenDisplay(fromToken).symbol}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowDownUp className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* You Receive */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">You receive</p>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-gray-900">{toAmount} {getTokenDisplay(toToken).symbol}</p>
                      <TokenLogo 
                        token={typeof toToken === 'string' && isAddress(toToken) ? getTokenDisplay(toToken).symbol : toToken} 
                        size={40}
                        address={typeof toToken === 'string' && isAddress(toToken) ? toToken : undefined}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                      Balance: {parseFloat(toBalance).toFixed(4)} {getTokenDisplay(toToken).symbol}
                    </p>
                  </div>

                  {/* Swap Details */}
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    {/* Swap Route (for multi-hop) */}
                    {swapPath && swapPath.length > 2 && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <p className="text-xs text-gray-600 mb-2">Swap Route</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {swapPath.map((token, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <TokenLogo token={token} size={20} />
                                <span className="text-sm font-medium text-gray-900">{token}</span>
                              </div>
                              {index < swapPath.length - 1 && (
                                <ArrowDownUp className="w-3 h-3 text-orange-500" />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-orange-600 mt-2">
                          This swap will go through {swapPath.length - 1} hop{swapPath.length - 1 > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    {/* Rate */}
                    {exchangeRate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Rate</span>
                        <span className="font-medium text-gray-900">
                          1 {fromToken} = {exchangeRate.toFixed(6)} {toToken}
                        </span>
                      </div>
                    )}

                    {/* Price Impact */}
                    {priceImpact !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Price impact</span>
                        <span className={`font-medium ${
                          priceImpact > 5 ? 'text-red-600' : priceImpact > 1 ? 'text-yellow-600' : 'text-gray-900'
                        }`}>
                          {priceImpact.toFixed(3)}%
                        </span>
                      </div>
                    )}

                    {/* Max Slippage */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Max. slippage</span>
                      <span className="font-medium text-gray-900">{slippage}%</span>
                    </div>

                    {/* Minimum Receive */}
                    {minReceive && parseFloat(minReceive) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Receive at least</span>
                        <span className="font-medium text-gray-900">
                          {minReceive} {toToken}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Button */}
                  <motion.button
                    onClick={handleConfirmSwap}
                    className="w-full py-4 rounded-xl font-bold text-base bg-orange-500 text-white hover:bg-orange-600 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Confirm swap
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Modal */}
        <AnimatePresence>
          {showProgressModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => {
                // Don't close on background click during transaction
                // Only allow closing if we're not in an active step or if transaction is complete
                if (swapStep === 'none' || (swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed) && !isPending && !isConfirming)) {
                  setShowProgressModal(false);
                }
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
                style={{
                  boxShadow: `
                    0 0 30px rgba(251, 146, 60, 0.25),
                    0 0 60px rgba(251, 146, 60, 0.15),
                    0 10px 25px -5px rgba(0, 0, 0, 0.1),
                    0 4px 6px -2px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.9)
                  `
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Swap Progress</h3>
                  {/* Show close button when transaction is complete OR when not actively processing */}
                  {(swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed) && !isPending && !isConfirming) || 
                   (swapStep === 'approving' && !isPending && !isConfirming && approvalCompleted) ||
                   (!isPending && !isConfirming && swapStep === 'none') ? (
                    <button
                      onClick={() => {
                        setShowProgressModal(false);
                        if (swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed)) {
                          // Reset state when closing after successful swap
                          setSwapStep('none');
                          setFromAmount('');
                          setToAmount('');
                          setApprovalCompleted(false);
                          setSwapHash(null);
                          setSwapConfirmed(false);
                          setSwapStartTime(null);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {/* Approving Step */}
                  <div className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      swapStep === 'approving' && (isPending || isConfirming)
                        ? 'bg-orange-500'
                        : swapStep === 'swapping' && approvalCompleted
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}>
                      {swapStep === 'approving' && (isPending || isConfirming) ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : swapStep === 'swapping' && approvalCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        swapStep === 'approving' && (isPending || isConfirming)
                          ? 'text-orange-600'
                          : swapStep === 'swapping' && approvalCompleted
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}>
                        Approving {fromToken}
                      </p>
                      <p className="text-sm text-gray-500">
                        {swapStep === 'approving' && (isPending || isConfirming)
                          ? 'Waiting for confirmation...'
                          : swapStep === 'swapping' && approvalCompleted
                          ? 'Approval completed'
                          : 'Allow the contract to spend your tokens'}
                      </p>
                    </div>
                  </div>

                  {/* Swapping Step */}
                  <div className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      swapStep === 'swapping' && (isPending || isConfirming)
                        ? 'bg-orange-500'
                        : swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed) && !isPending && !isConfirming
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}>
                      {swapStep === 'swapping' && (isPending || isConfirming) ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed) && !isPending && !isConfirming ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        swapStep === 'swapping' && (isPending || isConfirming)
                          ? 'text-orange-600'
                          : swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed) && !isPending && !isConfirming
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}>
                        Swapping {fromToken} for {toToken}
                      </p>
                      <p className="text-sm text-gray-500">
                        {swapStep === 'swapping' && (isPending || isConfirming)
                          ? 'Waiting for confirmation...'
                          : swapStep === 'swapping' && swapHash && (isSuccess || swapConfirmed) && !isPending && !isConfirming
                          ? 'Swap completed!'
                          : 'Pending...'}
                      </p>
                    </div>
                  </div>

                  {/* Success Message - Only show when swap is actually confirmed */}
                  {/* Success message removed - now using SwapSuccessModal component */}

                  {/* Error Message */}
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200"
                    >
                      <p className="text-sm font-medium text-red-800">
                        Transaction Failed
                      </p>
                      <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>

        {/* Price Chart - Right Side */}
        <motion.div
          className="bg-white rounded-3xl p-6 border border-orange-200 shadow-xl flex-1 lg:max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{
            boxShadow: `
              0 0 20px rgba(251, 146, 60, 0.15),
              0 0 40px rgba(251, 146, 60, 0.1),
              0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06),
              inset 0 1px 0 rgba(255, 255, 255, 0.9)
            `
          }}
        >
          <PriceChart
            fromToken={fromTokenForPool}
            toToken={toTokenForPool}
            poolAddress={poolAddress}
            swapPath={swapPath}
            height={400}
          />
        </motion.div>
      </div>

      {/* Swap Activity - Show swap events for current pair */}
      <SwapActivity
        fromToken={fromTokenForPool}
        toToken={toTokenForPool}
        poolAddress={poolAddress}
      />

      {/* Activity Tab - Floating button and swap history */}
      <ActivityTab />

      {/* Swap Success Modal */}
      <SwapSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          // Reset ALL swap state when closing success modal
          setSwapStep('none');
          setFromAmount('');
          setToAmount('');
          setApprovalCompleted(false);
          setSwapHash(null);
          setSwapConfirmed(false);
          setSwapStartTime(null);
          setSuccessShownForHash(null); // CRITICAL: Reset success tracking so next swap can show success
          setSwapTransactionStarted(false); // CRITICAL: Reset transaction started flag
          setHasBeenPendingForCurrentHash(false); // CRITICAL: Reset pending state tracking
        }}
        fromToken={fromTokenForPool}
        toToken={toTokenForPool}
        fromAmount={fromAmount}
        toAmount={toAmount}
        price={exchangeRate}
      />
    </div>
  );
}

