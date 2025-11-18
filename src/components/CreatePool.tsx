import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, AlertCircle, CheckCircle2, Loader2, ArrowRight, X, ChevronDown, Search } from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, isAddress, formatUnits, type Address } from 'viem';
import { FACTORY_ABI, POOL_ABI, ERC20_ABI } from '../config/abis';
import { DEX_CONFIG } from '../config/dex';
import TokenLogo from './TokenLogo';
import { useDEX, useTokenBalance, usePoolReserves, TOKENS, type TokenSymbol, getPoolAddress, useTokenBalanceByAddress } from '../hooks/useDEX';

const AVAILABLE_TOKENS: TokenSymbol[] = ['USDC', 'EURC', 'SRAC', 'RACS', 'SACS', 'KITTY', 'DOGG']; // USDC first

// Custom token interface for ERC20 addresses
interface CustomToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

// Minimum USDC balance required to create a pool (5,000 USDC)
const MIN_USDC_BALANCE = 5000;
// Minimum ERC20 token balance required for ERC20-ERC20 pools (50,000 tokens)
const MIN_ERC20_BALANCE = 50000;

type Step = 'select-tokens' | 'enter-amounts';

export default function CreatePool() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>('select-tokens');
  const [tokenA, setTokenA] = useState(TOKENS.USDC.address); // Default to USDC
  const [tokenB, setTokenB] = useState(TOKENS.USDC.address); // Default to USDC
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTokenSelector, setShowTokenSelector] = useState<'A' | 'B' | null>(null);
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);
  const [unauthorizedModalType, setUnauthorizedModalType] = useState<'usdc' | 'erc20'>('usdc');
  
  // Custom tokens state
  const [customTokens, setCustomTokens] = useState<Map<Address, CustomToken>>(new Map());
  const [addressInput, setAddressInput] = useState('');
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [tokenFetchError, setTokenFetchError] = useState<string | null>(null);
  
  const isArcTestnet = chainId === 5042002;

  // Get USDC balance early for authorization check
  const { data: balanceUSDC } = useReadContract({
    address: TOKENS.USDC.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected && isArcTestnet },
  });

  // Check if user has sufficient USDC balance for pool creation
  const hasSufficientUSDC = useMemo(() => {
    if (!balanceUSDC || !isConnected) return false;
    // USDC has 6 decimals
    const usdcBalance = Number(formatUnits(balanceUSDC, TOKENS.USDC.decimals));
    return usdcBalance >= MIN_USDC_BALANCE;
  }, [balanceUSDC, isConnected]);

  // Get formatted USDC balance for display
  const usdcBalanceFormatted = useMemo(() => {
    if (!balanceUSDC || !isConnected) return '0.00';
    return formatUnits(balanceUSDC, TOKENS.USDC.decimals);
  }, [balanceUSDC, isConnected]);

  const isValidA = tokenA && isAddress(tokenA);
  const isValidB = tokenB && isAddress(tokenB);

  // Check if a token address is USDC
  const isUSDC = useCallback((tokenAddress: Address | string): boolean => {
    if (!tokenAddress) return false;
    return (tokenAddress as string).toLowerCase() === TOKENS.USDC.address.toLowerCase();
  }, []);

  // Check if one of the tokens is USDC (required for pool creation)
  const hasUSDCPair = useMemo(() => {
    if (!isValidA || !isValidB) return false;
    return isUSDC(tokenA) || isUSDC(tokenB);
  }, [isValidA, isValidB, tokenA, tokenB, isUSDC]);

  // Get the non-USDC token address (for ERC20-ERC20 validation)
  const nonUSDCToken = useMemo(() => {
    if (!hasUSDCPair || !isValidA || !isValidB) return null;
    if (isUSDC(tokenA)) return tokenB as Address;
    if (isUSDC(tokenB)) return tokenA as Address;
    return null;
  }, [hasUSDCPair, isValidA, isValidB, tokenA, tokenB, isUSDC]);

  // Check if this is an ERC20-ERC20 pair (neither token is USDC)
  const isERC20ERC20Pair = useMemo(() => {
    if (!isValidA || !isValidB) return false;
    return !isUSDC(tokenA) && !isUSDC(tokenB);
  }, [isValidA, isValidB, tokenA, tokenB, isUSDC]);

  // Close token selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTokenSelector) {
        setShowTokenSelector(null);
      }
    };
    if (showTokenSelector) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTokenSelector]);

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
  const handleAddressInput = useCallback(async (input: string, type: 'A' | 'B') => {
    setAddressInput(input);
    setTokenFetchError(null);
    
    // Auto-fetch when valid address is detected
    if (input && isAddress(input)) {
      // Check USDC balance requirement before proceeding
      if (isConnected && !hasSufficientUSDC) {
        setShowUnauthorizedModal(true);
        setAddressInput('');
        return;
      }
      
      const tokenInfo = await fetchTokenInfo(input as Address);
      if (tokenInfo) {
        // Auto-select the token after fetching
        if (type === 'A') {
          setTokenA(tokenInfo.address);
        } else {
          setTokenB(tokenInfo.address);
        }
        setAddressInput('');
        setShowTokenSelector(null);
      }
    }
  }, [fetchTokenInfo, isConnected, hasSufficientUSDC]);
  
  // Get token display info (symbol or custom token symbol)
  const getTokenDisplay = useCallback((tokenAddress: Address | string): { symbol: string; name?: string; isCustom: boolean } => {
    if (typeof tokenAddress === 'string' && isAddress(tokenAddress)) {
      const customToken = customTokens.get(tokenAddress as Address);
      if (customToken) {
        return { symbol: customToken.symbol, name: customToken.name, isCustom: true };
      }
      // Try to find in TOKENS
      const tokenEntry = Object.entries(TOKENS).find(
        ([_, info]) => info.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      if (tokenEntry) {
        return { symbol: tokenEntry[0], isCustom: false };
      }
      return { symbol: `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`, isCustom: true };
    }
    return { symbol: 'USDC', isCustom: false };
  }, [customTokens]);

  // Select token from dropdown
  const selectToken = (tokenSymbol: TokenSymbol | Address, type: 'A' | 'B') => {
    // Check USDC balance requirement before proceeding
    if (isConnected && !hasSufficientUSDC) {
      setShowUnauthorizedModal(true);
      setShowTokenSelector(null);
      return;
    }

    const tokenAddress = typeof tokenSymbol === 'string' && isAddress(tokenSymbol)
      ? tokenSymbol as Address
      : TOKENS[tokenSymbol as TokenSymbol].address;
      
    if (type === 'A') {
      setTokenA(tokenAddress);
    } else {
      setTokenB(tokenAddress);
    }
    setShowTokenSelector(null);
    setAddressInput('');
    setTokenFetchError(null);
  };
  
  // Token item component for predefined tokens
  const TokenItem = ({ token, isSelected, onSelect, type }: { token: TokenSymbol; isSelected: boolean; onSelect: () => void; type: 'A' | 'B' }) => {
    const tokenBalance = useTokenBalance(token);
    return (
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        whileHover={{ scale: 1.02, x: 4 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 rounded-lg min-h-[60px] ${
          isSelected ? 'bg-orange-50' : ''
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <TokenLogo token={token} size={32} className="flex-shrink-0" address={undefined} />
          <div className="flex flex-col items-start justify-center flex-1 min-w-0">
            <span className="font-semibold text-gray-900 leading-tight">{token}</span>
            {TOKENS[token] && (
              <span className="text-xs text-gray-500 leading-tight">{TOKENS[token].address.slice(0, 6)}...{TOKENS[token].address.slice(-4)}</span>
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
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 rounded-lg min-h-[60px] ${
          isSelected ? 'bg-orange-50' : ''
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <TokenLogo token={token.symbol} size={32} className="flex-shrink-0" address={token.address} />
          <div className="flex flex-col items-start justify-center flex-1 min-w-0">
            <span className="font-semibold text-gray-900 leading-tight">{token.symbol}</span>
            {token.address && (
              <span className="text-xs text-gray-500 leading-tight">{token.address.slice(0, 6)}...{token.address.slice(-4)}</span>
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

  // Fetch balances for all tokens when dropdown is open
  const { data: balanceSRAC } = useReadContract({
    address: TOKENS.SRAC.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected && isArcTestnet },
  });

  const { data: balanceRACS } = useReadContract({
    address: TOKENS.RACS.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected && isArcTestnet },
  });

  const { data: balanceSACS } = useReadContract({
    address: TOKENS.SACS.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected && isArcTestnet },
  });

  // Format balances
  const getTokenBalance = (tokenSymbol: TokenSymbol): string => {
    let balance: bigint | undefined;
    switch (tokenSymbol) {
      case 'SRAC':
        balance = balanceSRAC;
        break;
      case 'RACS':
        balance = balanceRACS;
        break;
      case 'SACS':
        balance = balanceSACS;
        break;
      case 'USDC':
        balance = balanceUSDC;
        break;
    }
    if (!balance) return '0';
    return formatUnits(balance, TOKENS[tokenSymbol].decimals);
  };

  // Get token info for display
  const { data: symbolA } = useReadContract({
    address: isValidA ? (tokenA as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: !!isValidA },
  });

  const { data: decimalsA } = useReadContract({
    address: isValidA ? (tokenA as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!isValidA },
  });

  const { data: nameA } = useReadContract({
    address: isValidA ? (tokenA as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'name',
    query: { enabled: !!isValidA },
  });

  const { data: symbolB } = useReadContract({
    address: isValidB ? (tokenB as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: !!isValidB },
  });

  const { data: decimalsB } = useReadContract({
    address: isValidB ? (tokenB as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!isValidB },
  });

  const { data: nameB } = useReadContract({
    address: isValidB ? (tokenB as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'name',
    query: { enabled: !!isValidB },
  });

  // Sort tokens by address (factory stores pools with lower address first)
  const sortedTokens = useMemo<[Address, Address] | null>(() => {
    if (!isValidA || !isValidB || !tokenA || !tokenB) return null;
    const tokenAAddr = (tokenA as string).toLowerCase();
    const tokenBAddr = (tokenB as string).toLowerCase();
    return tokenAAddr < tokenBAddr 
      ? [tokenA as Address, tokenB as Address]
      : [tokenB as Address, tokenA as Address];
  }, [isValidA, isValidB, tokenA, tokenB]);

  // Check if pool exists - use sorted tokens
  const { data: existingPool } = useReadContract({
    address: DEX_CONFIG.FACTORY_ADDRESS as Address,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: sortedTokens ? sortedTokens : undefined,
    query: { enabled: !!(isValidA && isValidB && sortedTokens) },
  });
  
  // Get pool reserves (always call hook, but it will return empty if pool doesn't exist)
  const poolReserves = usePoolReserves(
    isValidA ? (tokenA as Address) : '0x0',
    isValidB ? (tokenB as Address) : '0x0'
  );

  // Check if pool address exists in factory (determines if we can call createPool)
  // The contract will reject createPool if a pool address already exists
  const poolAddressExists = useMemo(() => {
    return existingPool && existingPool !== '0x0000000000000000000000000000000000000000';
  }, [existingPool]);

  // Check if pool has actual liquidity (for UI display and price calculation)
  // A pool can exist in factory but have zero reserves if all liquidity was removed
  const poolHasLiquidity = useMemo(() => {
    if (!poolAddressExists) return false;
    
    // Check if pool actually has reserves (has liquidity)
    if (poolReserves.reserveA !== undefined && poolReserves.reserveB !== undefined) {
      const reserveA = parseFloat(poolReserves.reserveA || '0');
      const reserveB = parseFloat(poolReserves.reserveB || '0');
      return reserveA > 0 && reserveB > 0;
    }
    
    // If reserves haven't loaded yet, assume it might have liquidity
    // This will be updated when reserves load
    return true;
  }, [poolAddressExists, poolReserves.reserveA, poolReserves.reserveB]);

  // For UI: "pool exists" means it has liquidity (for display purposes)
  const poolExists = poolHasLiquidity;

  // Calculate current price from reserves (for existing pools)
  const currentPrice = useMemo(() => {
    if (!poolExists || !poolReserves.reserveA || !poolReserves.reserveB || parseFloat(poolReserves.reserveB) <= 0) return null;
    return parseFloat(poolReserves.reserveA) / parseFloat(poolReserves.reserveB);
  }, [poolExists, poolReserves]);

  // Auto-calculate amountB based on amountA and current price (for existing pools)
  useEffect(() => {
    if (step === 'enter-amounts' && poolExists && amountA && currentPrice && parseFloat(amountA) > 0) {
      // For existing pools, calculate B based on A and pool price
      // Price = reserveA / reserveB, so amountB = amountA / price
      const calculatedB = (parseFloat(amountA) / currentPrice).toFixed(6);
      setAmountB(calculatedB);
    } else if (!amountA && step === 'enter-amounts') {
      setAmountB('');
    }
  }, [amountA, currentPrice, poolExists, step]);

  // Calculate starting price (only for new pools)
  const startingPrice = useMemo(() => {
    if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) return null;
    if (poolExists) return null; // Don't show starting price if pool already exists
    return parseFloat(amountB) / parseFloat(amountA);
  }, [amountA, amountB, poolExists]);

  // Try to match token addresses to known symbols
  const tokenASymbolKey = useMemo(() => {
    if (!isValidA) return null;
    const entry = Object.entries(TOKENS).find(
      ([_, info]) => info.address.toLowerCase() === (tokenA as string).toLowerCase()
    );
    return entry ? entry[0] : (symbolA as string);
  }, [isValidA, tokenA, symbolA]);

  const tokenBSymbolKey = useMemo(() => {
    if (!isValidB) return null;
    const entry = Object.entries(TOKENS).find(
      ([_, info]) => info.address.toLowerCase() === (tokenB as string).toLowerCase()
    );
    return entry ? entry[0] : (symbolB as string);
  }, [isValidB, tokenB, symbolB]);

  // Always read balance directly from token addresses (most reliable)
  const { data: balanceARaw } = useReadContract({
    address: (isValidA && address && isConnected && tokenA) ? (tokenA as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!(address && isConnected && isValidA && tokenA && isArcTestnet) },
  });
  
  const { data: balanceBRaw } = useReadContract({
    address: (isValidB && address && isConnected && tokenB) ? (tokenB as Address) : undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!(address && isConnected && isValidB && tokenB && isArcTestnet) },
  });

  // Format balances using decimals (use contract decimals if available, otherwise default to 18)
  const balanceAFinal = useMemo(() => {
    if (!balanceARaw) return '0';
    const decimals = decimalsA ? Number(decimalsA) : 18;
    return formatUnits(balanceARaw, decimals);
  }, [balanceARaw, decimalsA]);

  const balanceBFinal = useMemo(() => {
    if (!balanceBRaw) return '0';
    const decimals = decimalsB ? Number(decimalsB) : 18;
    return formatUnits(balanceBRaw, decimals);
  }, [balanceBRaw, decimalsB]);

  // Check if user has sufficient ERC20 balance for ERC20-ERC20 pool creation
  const hasSufficientERC20 = useMemo(() => {
    if (!isERC20ERC20Pair || !isConnected || !balanceARaw || !balanceBRaw) return false;
    
    // For ERC20-ERC20 pairs, check if user has at least 50k of either token
    const decimalsAVal = decimalsA ? Number(decimalsA) : 18;
    const decimalsBVal = decimalsB ? Number(decimalsB) : 18;
    const balanceA = Number(formatUnits(balanceARaw, decimalsAVal));
    const balanceB = Number(formatUnits(balanceBRaw, decimalsBVal));
    
    return balanceA >= MIN_ERC20_BALANCE || balanceB >= MIN_ERC20_BALANCE;
  }, [isERC20ERC20Pair, isConnected, balanceARaw, balanceBRaw, decimalsA, decimalsB]);

  const { writeContract, data: createHash, isPending: isCreating, error: writeError } = useWriteContract();
  const { isLoading: isConfirmingCreate, isSuccess: poolCreated } = useWaitForTransactionReceipt({ hash: createHash });

  const { addLiquidity, approveToken, isPending: isAddingLiquidity, isConfirming: isConfirmingLiquidity, isSuccess: transactionSuccess, error: liquidityError } = useDEX();
  
  // Approval flow state
  const [approvalStep, setApprovalStep] = useState<'none' | 'approvingA' | 'approvingB' | 'adding'>('none');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [liquiditySuccess, setLiquiditySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedApprovalStep, setCompletedApprovalStep] = useState<'none' | 'approvingA' | 'approvingB'>('none');
  const [hasStartedPostCreationFlow, setHasStartedPostCreationFlow] = useState(false);
  const [modalManuallyClosed, setModalManuallyClosed] = useState(false);
  // Stable step completion tracking to prevent flickering
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const handleContinueToAmounts = () => {
    setError(null);
    
    if (!isAddress(tokenA) || !isAddress(tokenB)) {
      setError('Please enter valid token addresses');
      return;
    }
    
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      setError('Token addresses must be different');
      return;
    }

    // Check if one token is USDC (required)
    if (!hasUSDCPair) {
      setError('One of the tokens must be USDC. Only USDC pair pools are allowed.');
      return;
    }

    // For USDC pairs, check USDC balance requirement
    if (isConnected && hasUSDCPair && !isERC20ERC20Pair) {
      if (!hasSufficientUSDC) {
        setUnauthorizedModalType('usdc');
        setShowUnauthorizedModal(true);
        return;
      }
    }

    // For ERC20-ERC20 pairs (should not happen if validation works, but check anyway)
    if (isConnected && isERC20ERC20Pair) {
      if (!hasSufficientERC20) {
        setUnauthorizedModalType('erc20');
        setShowUnauthorizedModal(true);
        return;
      }
    }

    setStep('enter-amounts');
  };

  const formatErrorMessage = (err: any): string => {
    if (!err) return 'Unknown error occurred';
    const errorStr = err.message || err.toString() || '';
    if (errorStr.includes('User rejected') || errorStr.includes('User denied')) {
      return 'Transaction was cancelled. Please try again when ready.';
    }
    if (errorStr.includes('allowance') || errorStr.includes('Allowance')) {
      return 'Token approval required. Please approve and try again.';
    }
    if (errorStr.includes('NEED_APPROVE')) {
      return 'Token approval required.';
    }
    return errorStr || 'An unexpected error occurred. Please try again.';
  };

  const handleCreatePool = async () => {
    setError(null);
    
    if (!isAddress(tokenA) || !isAddress(tokenB)) {
      setError('Please enter valid token addresses');
      return;
    }

    // Check if one token is USDC (required)
    if (!hasUSDCPair) {
      setError('One of the tokens must be USDC. Only USDC pair pools are allowed.');
      return;
    }

    // For USDC pairs, check USDC balance requirement
    if (isConnected && hasUSDCPair && !isERC20ERC20Pair) {
      if (!hasSufficientUSDC) {
        setUnauthorizedModalType('usdc');
        setShowUnauthorizedModal(true);
        return;
      }
    }

    // For ERC20-ERC20 pairs, check 50k minimum requirement
    if (isConnected && isERC20ERC20Pair) {
      if (!hasSufficientERC20) {
        setUnauthorizedModalType('erc20');
        setShowUnauthorizedModal(true);
        return;
      }
    }

    if (!tokenASymbolKey || !tokenBSymbolKey) {
      setError('Unable to identify token symbols');
      return;
    }

    if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
      setError('Please enter valid amounts');
      return;
    }

    setShowProgressModal(true);
    setApprovalStep('none');

    try {
      // Only try to create pool if factory doesn't have a pool address for this pair
      // The contract will reject createPool if pool address already exists (even with zero liquidity)
      if (!poolAddressExists) {
        setApprovalStep('adding'); // Will handle pool creation
        writeContract({
          address: DEX_CONFIG.FACTORY_ADDRESS as Address,
          abi: FACTORY_ABI,
          functionName: 'createPool',
          args: sortedTokens || [tokenA as Address, tokenB as Address],
        });
      } else {
        // Pool exists, try to add liquidity (this will throw if approvals needed)
        setApprovalStep('adding');
        await addLiquidity(
          tokenASymbolKey as TokenSymbol,
          tokenBSymbolKey as TokenSymbol,
          amountA,
          amountB
        );
      }
    } catch (err: any) {
      console.error('Create pool/add liquidity error:', err);
      const errorMsg = err.message || err.toString() || '';
      
      // Handle approval errors
      if (errorMsg.includes('NEED_APPROVE_A')) {
        setApprovalStep('approvingA');
        // Get pool address for approval - try to fetch it if not available
        const fetchPoolAddress = async () => {
          let poolAddr: Address | null = null;
          
          // Try existingPool first
          if (existingPool && existingPool !== '0x0000000000000000000000000000000000000000') {
            poolAddr = existingPool as Address;
          } else if (poolReserves.poolAddress && poolReserves.poolAddress !== '0x0000000000000000000000000000000000000000') {
            poolAddr = poolReserves.poolAddress;
          } else if (publicClient) {
            // Try to fetch from factory
            try {
              poolAddr = await getPoolAddress(tokenA as Address, tokenB as Address, publicClient);
            } catch (fetchErr) {
              console.error('Error fetching pool address:', fetchErr);
            }
          }
          
          if (poolAddr) {
            try {
              approveToken(tokenASymbolKey as TokenSymbol, poolAddr);
            } catch (approveErr: any) {
              console.error('Error approving token A:', approveErr);
              setError(formatErrorMessage(approveErr));
              setShowProgressModal(false);
              setApprovalStep('none');
            }
          } else {
            setError('Pool address not found. Please wait for pool creation to complete.');
            setShowProgressModal(false);
            setApprovalStep('none');
          }
        };
        
        fetchPoolAddress();
      } else if (errorMsg.includes('NEED_APPROVE_B')) {
        setApprovalStep('approvingB');
        // Get pool address for approval
        const fetchPoolAddress = async () => {
          let poolAddr: Address | null = null;
          
          // Try existingPool first
          if (existingPool && existingPool !== '0x0000000000000000000000000000000000000000') {
            poolAddr = existingPool as Address;
          } else if (poolReserves.poolAddress && poolReserves.poolAddress !== '0x0000000000000000000000000000000000000000') {
            poolAddr = poolReserves.poolAddress;
          } else if (publicClient) {
            // Try to fetch from factory
            try {
              poolAddr = await getPoolAddress(tokenA as Address, tokenB as Address, publicClient);
            } catch (fetchErr) {
              console.error('Error fetching pool address:', fetchErr);
            }
          }
          
          if (poolAddr) {
            try {
              approveToken(tokenBSymbolKey as TokenSymbol, poolAddr);
            } catch (approveErr: any) {
              console.error('Error approving token B:', approveErr);
              setError(formatErrorMessage(approveErr));
              setShowProgressModal(false);
              setApprovalStep('none');
            }
          } else {
            setError('Pool address not found. Please wait for pool creation to complete.');
            setShowProgressModal(false);
            setApprovalStep('none');
          }
        };
        
        fetchPoolAddress();
      } else {
        const formattedError = formatErrorMessage(err);
        setError(formattedError);
        setErrorMessage(formattedError);
        setShowProgressModal(false);
        setApprovalStep('none');
      }
    }
  };

  // Track transaction progress - KEEP MODAL OPEN during entire flow
  useEffect(() => {
    // Don't reopen modal if it was manually closed after completion
    if (modalManuallyClosed && liquiditySuccess) {
      return;
    }
    
    // Reset manual close flag when new transaction starts
    if (isCreating || isConfirmingCreate) {
      setModalManuallyClosed(false);
    }
    
    // Open modal if any transaction is in progress OR pool was just created (waiting for approvals/liquidity)
    // BUT only if we're not already in success state
    const hasActiveTransaction = isAddingLiquidity || isConfirmingLiquidity || isCreating || isConfirmingCreate;
    const shouldKeepOpenForFlow = poolCreated && !liquiditySuccess && approvalStep !== 'none' && !modalManuallyClosed;
    
    if (hasActiveTransaction || shouldKeepOpenForFlow) {
      if (!showProgressModal) {
        setShowProgressModal(true);
      }
    } else if (transactionSuccess && approvalStep === 'adding') {
      // Only close modal when liquidity addition is fully complete
      setCompletedSteps(prev => new Set(prev).add('adding')); // Mark adding liquidity as completed
      setLiquiditySuccess(true);
      // Don't auto-close, let user close manually or after delay
      setTimeout(() => {
        // Only auto-close if user hasn't manually closed
        if (showProgressModal && !modalManuallyClosed) {
          setShowProgressModal(false);
          setApprovalStep('none');
          setLiquiditySuccess(false);
          setAmountA('');
          setAmountB('');
          setCompletedApprovalStep('none');
          setHasStartedPostCreationFlow(false);
        }
      }, 2500);
    } else if (liquidityError || writeError) {
      const errorMsg = liquidityError?.message || writeError?.message || '';
      if (errorMsg.includes('NEED_APPROVE')) {
        // Keep modal open - approvals will be handled
        return;
      }
      // Only show error and close modal for actual errors, not approval needs
      if (approvalStep === 'adding') {
        setError(formatErrorMessage(liquidityError || writeError));
        setErrorMessage(formatErrorMessage(liquidityError || writeError));
        setTimeout(() => {
          setShowProgressModal(false);
          setApprovalStep('none');
        }, 3000);
      }
    }
  }, [isAddingLiquidity, isConfirmingLiquidity, isCreating, isConfirmingCreate, transactionSuccess, liquidityError, writeError, approvalStep, showProgressModal, poolCreated, liquiditySuccess, modalManuallyClosed]);

  // Auto-proceed after approval completes
  useEffect(() => {
    // Only proceed when approval transaction succeeds and we haven't already processed this approval
    if (transactionSuccess && !isAddingLiquidity && !isConfirmingLiquidity && (approvalStep === 'approvingA' || approvalStep === 'approvingB') && completedApprovalStep !== approvalStep) {
      const proceed = async () => {
        try {
          // Mark this approval as completed
          setCompletedApprovalStep(approvalStep);
          setCompletedSteps(prev => new Set(prev).add(approvalStep)); // Mark step as completed to prevent flickering
          
          // Ensure modal stays open
          if (!showProgressModal) {
            setShowProgressModal(true);
          }
          
          // Wait a bit for the blockchain to update
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Get pool address
          let poolAddr: Address | null = null;
          if (poolReserves.poolAddress && poolReserves.poolAddress !== '0x0000000000000000000000000000000000000000') {
            poolAddr = poolReserves.poolAddress;
          } else if (existingPool && existingPool !== '0x0000000000000000000000000000000000000000') {
            poolAddr = existingPool as Address;
          } else if (publicClient) {
            poolAddr = await getPoolAddress(tokenA as Address, tokenB as Address, publicClient);
          }
          
          if (!poolAddr || !publicClient || !address) {
            throw new Error('Pool address not found or client not available');
          }

          const tokenAInfo = TOKENS[tokenASymbolKey as TokenSymbol];
          const tokenBInfo = TOKENS[tokenBSymbolKey as TokenSymbol];
          const amountAWei = parseUnits(amountA, tokenAInfo.decimals);
          const amountBWei = parseUnits(amountB, tokenBInfo.decimals);

          // Check current allowances again
          const [allowanceA, allowanceB] = await Promise.all([
            publicClient.readContract({
              address: tokenAInfo.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, poolAddr],
            }),
            publicClient.readContract({
              address: tokenBInfo.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, poolAddr],
            }),
          ]);

          if (approvalStep === 'approvingA') {
            // Token A should be approved now, check if B also needs approval
            if (allowanceB < amountBWei) {
              // Still need to approve Token B
              setApprovalStep('approvingB');
              setCompletedApprovalStep('none'); // Reset to allow next approval
              approveToken(tokenBSymbolKey as TokenSymbol, poolAddr);
            } else {
              // Both approved, proceed to add liquidity
              setApprovalStep('adding');
              setCompletedApprovalStep('none'); // Reset
              await addLiquidity(
                tokenASymbolKey as TokenSymbol,
                tokenBSymbolKey as TokenSymbol,
                amountA,
                amountB
              );
            }
          } else if (approvalStep === 'approvingB') {
            // Token B should be approved now, check if A is also approved
            if (allowanceA < amountAWei) {
              // This shouldn't happen, but handle it
              setApprovalStep('approvingA');
              setCompletedApprovalStep('none'); // Reset to allow next approval
              approveToken(tokenASymbolKey as TokenSymbol, poolAddr);
            } else {
              // Both approved, proceed to add liquidity
              setApprovalStep('adding');
              setCompletedApprovalStep('none'); // Reset
              await addLiquidity(
                tokenASymbolKey as TokenSymbol,
                tokenBSymbolKey as TokenSymbol,
                amountA,
                amountB
              );
            }
          }
        } catch (err: any) {
          console.error('Error proceeding after approval:', err);
          const errorMsg = err?.message || err?.toString() || '';
          
          // Handle approval errors that might occur during auto-proceed
          if (errorMsg.includes('NEED_APPROVE_A')) {
            const poolAddr = poolReserves.poolAddress || existingPool;
            if (poolAddr) {
              setApprovalStep('approvingA');
              setCompletedApprovalStep('none');
              approveToken(tokenASymbolKey as TokenSymbol, poolAddr as Address);
            }
          } else if (errorMsg.includes('NEED_APPROVE_B')) {
            const poolAddr = poolReserves.poolAddress || existingPool;
            if (poolAddr) {
              setApprovalStep('approvingB');
              setCompletedApprovalStep('none');
              approveToken(tokenBSymbolKey as TokenSymbol, poolAddr as Address);
            }
          } else {
            setError(formatErrorMessage(err));
            setErrorMessage(formatErrorMessage(err));
            // Don't close modal on error, let user see what went wrong
          }
        }
      };
      proceed();
    }
  }, [transactionSuccess, approvalStep, poolReserves.poolAddress, tokenASymbolKey, tokenBSymbolKey, amountA, amountB, addLiquidity, approveToken, isAddingLiquidity, isConfirmingLiquidity, completedApprovalStep, showProgressModal, existingPool, publicClient, tokenA, tokenB, address, getPoolAddress]);

  // Auto-add liquidity after pool is created - IMPROVED FLOW
  useEffect(() => {
    // Only trigger once after pool is created
    // poolCreated means we just successfully created a pool (poolAddressExists is now true)
    // But poolHasLiquidity is still false because we haven't added liquidity yet
    if (
      poolCreated && 
      !hasStartedPostCreationFlow && // Prevent duplicate triggers
      !poolHasLiquidity && // Only auto-add if pool doesn't have liquidity yet
      amountA && 
      amountB && 
      parseFloat(amountA) > 0 && 
      parseFloat(amountB) > 0 && 
      tokenASymbolKey && 
      tokenBSymbolKey && 
      publicClient &&
      address &&
      showProgressModal // Ensure modal is open
    ) {
      // Mark that we've started the flow
      setHasStartedPostCreationFlow(true);
      
      // Wait a bit for pool to be ready, then check approvals and add liquidity
      setTimeout(async () => {
        try {
          // Fetch pool address - try multiple ways
          let poolAddr: Address | null = null;
          
          if (poolReserves.poolAddress && poolReserves.poolAddress !== '0x0000000000000000000000000000000000000000') {
            poolAddr = poolReserves.poolAddress;
          } else if (existingPool && existingPool !== '0x0000000000000000000000000000000000000000') {
            poolAddr = existingPool as Address;
          } else {
            // Fetch directly from factory
            poolAddr = await getPoolAddress(tokenA as Address, tokenB as Address, publicClient);
          }
          
          if (!poolAddr) {
            console.error('Pool address not found after creation');
            setError('Pool address not found. Please try adding liquidity manually.');
            setShowProgressModal(false);
            setApprovalStep('none');
            setHasStartedPostCreationFlow(false);
            return;
          }

          const tokenAInfo = TOKENS[tokenASymbolKey as TokenSymbol];
          const tokenBInfo = TOKENS[tokenBSymbolKey as TokenSymbol];
          const amountAWei = parseUnits(amountA, tokenAInfo.decimals);
          const amountBWei = parseUnits(amountB, tokenBInfo.decimals);

          // IMPORTANT: Check allowances BEFORE attempting to add liquidity
          const [allowanceA, allowanceB] = await Promise.all([
            publicClient.readContract({
              address: tokenAInfo.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, poolAddr],
            }),
            publicClient.readContract({
              address: tokenBInfo.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, poolAddr],
            }),
          ]);

          // Determine what needs to be done based on allowances
          if (allowanceA < amountAWei && allowanceB < amountBWei) {
            // Need both approvals - start with A
            setApprovalStep('approvingA');
            approveToken(tokenASymbolKey as TokenSymbol, poolAddr);
            // Token B approval will be handled in the auto-proceed effect after A completes
          } else if (allowanceA < amountAWei) {
            // Only need A approval
            setApprovalStep('approvingA');
            approveToken(tokenASymbolKey as TokenSymbol, poolAddr);
          } else if (allowanceB < amountBWei) {
            // Only need B approval
            setApprovalStep('approvingB');
            approveToken(tokenBSymbolKey as TokenSymbol, poolAddr);
          } else {
            // Both approved, proceed directly to add liquidity
            setApprovalStep('adding');
            await addLiquidity(
              tokenASymbolKey as TokenSymbol,
              tokenBSymbolKey as TokenSymbol,
              amountA,
              amountB
            );
          }
        } catch (err: any) {
          console.error('Error in post-creation flow:', err);
          const errorMsg = err.message || err.toString() || '';
          
          // Handle approval errors
          if (errorMsg.includes('NEED_APPROVE_A')) {
            let poolAddr: Address | null = null;
            if (poolReserves.poolAddress && poolReserves.poolAddress !== '0x0000000000000000000000000000000000000000') {
              poolAddr = poolReserves.poolAddress;
            } else if (existingPool && existingPool !== '0x0000000000000000000000000000000000000000') {
              poolAddr = existingPool as Address;
            } else if (publicClient) {
              poolAddr = await getPoolAddress(tokenA as Address, tokenB as Address, publicClient);
            }
            
            if (poolAddr) {
              setApprovalStep('approvingA');
              approveToken(tokenASymbolKey as TokenSymbol, poolAddr);
            } else {
              setError('Pool address not found. Please try adding liquidity manually.');
              setShowProgressModal(false);
              setApprovalStep('none');
              setHasStartedPostCreationFlow(false);
            }
          } else if (errorMsg.includes('NEED_APPROVE_B')) {
            let poolAddr: Address | null = null;
            if (poolReserves.poolAddress && poolReserves.poolAddress !== '0x0000000000000000000000000000000000000000') {
              poolAddr = poolReserves.poolAddress;
            } else if (existingPool && existingPool !== '0x0000000000000000000000000000000000000000') {
              poolAddr = existingPool as Address;
            } else if (publicClient) {
              poolAddr = await getPoolAddress(tokenA as Address, tokenB as Address, publicClient);
            }
            
            if (poolAddr) {
              setApprovalStep('approvingB');
              approveToken(tokenBSymbolKey as TokenSymbol, poolAddr);
            } else {
              setError('Pool address not found. Please try adding liquidity manually.');
              setShowProgressModal(false);
              setApprovalStep('none');
              setHasStartedPostCreationFlow(false);
            }
          } else {
            setError(formatErrorMessage(err));
            setShowProgressModal(false);
            setApprovalStep('none');
            setHasStartedPostCreationFlow(false);
          }
        }
      }, 2000); // Wait 2 seconds for pool to be fully ready
    }
  }, [poolCreated, hasStartedPostCreationFlow, poolHasLiquidity, amountA, amountB, tokenASymbolKey, tokenBSymbolKey, addLiquidity, approveToken, showProgressModal, poolReserves.poolAddress, existingPool, publicClient, tokenA, tokenB, address, getPoolAddress]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <motion.div
        className="bg-white rounded-2xl p-4 sm:p-6 border border-orange-200 shadow-xl relative"
        style={{
          boxShadow: `
            0 0 20px rgba(251, 146, 60, 0.15),
            0 0 40px rgba(251, 146, 60, 0.1),
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9)
          `
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">New position</h2>
        </div>

        {/* Steps Indicator */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            {/* Step 1 */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-sm sm:text-base relative z-10 ${
                step === 'select-tokens' ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                1
              </div>
              <div className={`text-xs sm:text-sm font-medium ${step === 'select-tokens' ? 'text-orange-600' : 'text-gray-600'}`}>
                Select token pair
              </div>
            </div>

            {/* Connecting Line */}
            <div className="flex-1 mx-4 h-0.5 sm:h-1 relative">
              {/* Gray Background Line */}
              <div className="absolute inset-0 bg-gray-300 rounded-full" />
              {/* Orange Fill Line (fills when step 2 is active) */}
              <motion.div
                className="absolute inset-0 bg-orange-500 rounded-full origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: step === 'enter-amounts' ? 1 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-sm sm:text-base relative z-10 ${
                step === 'enter-amounts' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
              <div className={`text-xs sm:text-sm font-medium ${step === 'enter-amounts' ? 'text-orange-600' : 'text-gray-500'}`}>
                Enter deposit amounts
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Select Tokens */}
        {step === 'select-tokens' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Info Note */}
            {isValidA && isValidB && !hasUSDCPair ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-800">
                    <span className="font-semibold">Error:</span> One of the tokens must be USDC. Only USDC pair pools are allowed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">Note:</span> Only USDC pair pools are allowed. One of the tokens must be USDC.
                  </p>
                </div>
              </div>
            )}

            {/* Token A and B on same line */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Token A */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token A
                </label>
                <div className="space-y-2">
                  {/* Token Selector Button */}
                  <div className="relative">
                    <motion.button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTokenSelector(showTokenSelector === 'A' ? null : 'A');
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-all"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center gap-2">
                        {tokenA && isValidA && (
                          <TokenLogo 
                            token={getTokenDisplay(tokenA).symbol} 
                            size={24} 
                            className="flex-shrink-0"
                            address={getTokenDisplay(tokenA).isCustom ? tokenA : undefined}
                          />
                        )}
                        <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-gray-900">
                            {tokenA && isValidA ? getTokenDisplay(tokenA).symbol : 'Select token'}
                        </span>
                          {tokenA && isValidA && getTokenDisplay(tokenA).name && (
                            <span className="text-xs text-gray-500">{getTokenDisplay(tokenA).name}</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    </motion.button>
                    <AnimatePresence>
                      {showTokenSelector === 'A' && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 min-w-[400px] max-h-[600px] overflow-hidden flex flex-col"
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
                              onChange={(e) => handleAddressInput(e.target.value, 'A')}
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
                              {AVAILABLE_TOKENS.map((tokenSymbol) => (
                                <TokenItem
                                key={tokenSymbol}
                                  token={tokenSymbol}
                                  isSelected={tokenA === TOKENS[tokenSymbol].address}
                                  onSelect={() => selectToken(tokenSymbol, 'A')}
                                  type="A"
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
                                    isSelected={tokenA === token.address}
                                    onSelect={() => selectToken(token.address, 'A')}
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
                {isValidA && (symbolA || nameA) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TokenLogo 
                        token={getTokenDisplay(tokenA).symbol || '?'} 
                        size={32} 
                        className="flex-shrink-0"
                        address={getTokenDisplay(tokenA).isCustom ? tokenA : undefined}
                      />
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{getTokenDisplay(tokenA).symbol || 'Unknown'}</div>
                      </div>
                    </div>
                    {address && isConnected && (
                      <div className="text-xs text-gray-600 whitespace-nowrap">
                        Balance: {balanceAFinal && !isNaN(parseFloat(balanceAFinal)) ? parseFloat(balanceAFinal).toFixed(4) : '0'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              </div>

              {/* Token B */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token B
                </label>
                <div className="space-y-2">
                  {/* Token Selector Button */}
                  <div className="relative">
                    <motion.button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTokenSelector(showTokenSelector === 'B' ? null : 'B');
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-all"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center gap-2">
                        {tokenB && isValidB && (
                          <TokenLogo 
                            token={getTokenDisplay(tokenB).symbol} 
                            size={24} 
                            className="flex-shrink-0"
                            address={getTokenDisplay(tokenB).isCustom ? tokenB : undefined}
                          />
                        )}
                        <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-gray-900">
                            {tokenB && isValidB ? getTokenDisplay(tokenB).symbol : 'USDC'}
                        </span>
                          {tokenB && isValidB && getTokenDisplay(tokenB).name && (
                            <span className="text-xs text-gray-500">{getTokenDisplay(tokenB).name}</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    </motion.button>
                    <AnimatePresence>
                      {showTokenSelector === 'B' && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 min-w-[400px] max-h-[600px] overflow-hidden flex flex-col"
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
                              onChange={(e) => handleAddressInput(e.target.value, 'B')}
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
                              {AVAILABLE_TOKENS.map((tokenSymbol) => (
                                <TokenItem
                                key={tokenSymbol}
                                  token={tokenSymbol}
                                  isSelected={tokenB === TOKENS[tokenSymbol].address}
                                  onSelect={() => selectToken(tokenSymbol, 'B')}
                                  type="B"
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
                                    isSelected={tokenB === token.address}
                                    onSelect={() => selectToken(token.address, 'B')}
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
                {isValidB && (symbolB || nameB) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TokenLogo 
                        token={getTokenDisplay(tokenB).symbol} 
                        size={32} 
                        className="flex-shrink-0"
                        address={getTokenDisplay(tokenB).isCustom ? tokenB : undefined}
                      />
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{getTokenDisplay(tokenB).symbol || 'Unknown'}</div>
                      </div>
                    </div>
                    {address && isConnected && (
                      <div className="text-xs text-gray-600 whitespace-nowrap">
                        Balance: {balanceBFinal && !isNaN(parseFloat(balanceBFinal)) ? parseFloat(balanceBFinal).toFixed(4) : '0'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              </div>
            </div>

            {/* Pool Status */}
            {isValidA && isValidB && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-gray-50 border border-gray-200"
              >
                {poolExists ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Pool exists. You can add liquidity to it.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-orange-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">Pool does not exist. It will be created when you add initial liquidity.</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Continue Button */}
            <motion.button
              onClick={handleContinueToAmounts}
              disabled={!isConnected || !isArcTestnet || !tokenA || !tokenB || !isAddress(tokenA) || !isAddress(tokenB) || !hasUSDCPair}
              className={`w-full py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all duration-300 flex items-center justify-center gap-2 ${
                !isConnected || !isArcTestnet || !tokenA || !tokenB || !isAddress(tokenA) || !isAddress(tokenB) || !hasUSDCPair
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg active:scale-95'
              }`}
              whileHover={!isConnected || !isArcTestnet || !tokenA || !tokenB || !isAddress(tokenA) || !isAddress(tokenB) || !hasUSDCPair ? {} : { scale: 1.02 }}
              whileTap={!isConnected || !isArcTestnet || !tokenA || !tokenB || !isAddress(tokenA) || !isAddress(tokenB) || !hasUSDCPair ? {} : { scale: 0.98 }}
            >
              Continue
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          </motion.div>
        )}

        {/* Step 2: Enter Amounts */}
        {step === 'enter-amounts' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3 sm:space-y-4"
          >
            {/* Current Price Display */}
            {poolExists && poolReserves.poolAddress && (
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Current price</span>
                  <span className="font-medium text-gray-900">
                    {poolReserves.reserveA && poolReserves.reserveB && parseFloat(poolReserves.reserveB) > 0
                      ? `${(parseFloat(poolReserves.reserveA) / parseFloat(poolReserves.reserveB)).toFixed(6)} ${symbolA}/${symbolB}`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}

            {/* Starting Price Display (only for new pools) */}
            {!poolExists && startingPrice && (
              <div className="p-3 sm:p-4 bg-orange-50 rounded-xl border border-orange-200">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs sm:text-sm font-medium text-orange-900">Starting price</span>
                  <span className="text-xs sm:text-sm font-bold text-orange-900">
                    1 {symbolA} = {startingPrice.toFixed(6)} {symbolB}
                  </span>
                </div>
                <p className="text-xs text-orange-700 mt-1">
                  This ratio will become the initial trading price for the pool.
                </p>
              </div>
            )}

            {/* Amount Inputs - Side by side on larger screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Amount A */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                  {symbolA || 'Token A'} Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountA}
                    onChange={(e) => setAmountA(e.target.value)}
                    placeholder="0.0"
                    step="any"
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 pr-20 sm:pr-24 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2">
                    <TokenLogo 
                      token={getTokenDisplay(tokenA).symbol || '?'} 
                      size={20} 
                      className="sm:w-6 sm:h-6"
                      address={getTokenDisplay(tokenA).isCustom ? tokenA : undefined}
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">{symbolA || 'A'}</span>
                  </div>
                </div>
                <div className="mt-0.5 text-xs text-gray-500 whitespace-nowrap">
                  Balance: {balanceAFinal && !isNaN(parseFloat(balanceAFinal)) ? parseFloat(balanceAFinal).toFixed(4) : '0'} {symbolA || ''}
                </div>
              </div>

              {/* Amount B */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                  {symbolB || 'Token B'} Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountB}
                    onChange={(e) => setAmountB(e.target.value)}
                    placeholder="0.0"
                    step="any"
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 pr-20 sm:pr-24 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 sm:gap-2">
                    <TokenLogo 
                      token={getTokenDisplay(tokenB).symbol || '?'} 
                      size={20} 
                      className="sm:w-6 sm:h-6"
                      address={getTokenDisplay(tokenB).isCustom ? tokenB : undefined}
                    />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">{symbolB || 'B'}</span>
                  </div>
                </div>
                <div className="mt-0.5 text-xs text-gray-500 whitespace-nowrap">
                  Balance: {balanceBFinal && !isNaN(parseFloat(balanceBFinal)) ? parseFloat(balanceBFinal).toFixed(4) : '0'} {symbolB || ''}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3 pt-2">
              <motion.button
                onClick={() => setStep('select-tokens')}
                className="flex-1 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Back
              </motion.button>
              <motion.button
                onClick={handleCreatePool}
                disabled={
                  !isConnected ||
                  !isArcTestnet ||
                  !amountA ||
                  !amountB ||
                  parseFloat(amountA) <= 0 ||
                  parseFloat(amountB) <= 0 ||
                  isCreating ||
                  isConfirmingCreate ||
                  isAddingLiquidity ||
                  isConfirmingLiquidity
                }
                className={`flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
                  !isConnected ||
                  !isArcTestnet ||
                  !amountA ||
                  !amountB ||
                  parseFloat(amountA) <= 0 ||
                  parseFloat(amountB) <= 0 ||
                  isCreating ||
                  isConfirmingCreate ||
                  isAddingLiquidity ||
                  isConfirmingLiquidity
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
                whileHover={
                  !isConnected ||
                  !isArcTestnet ||
                  !amountA ||
                  !amountB ||
                  parseFloat(amountA) <= 0 ||
                  parseFloat(amountB) <= 0 ||
                  isCreating ||
                  isConfirmingCreate ||
                  isAddingLiquidity ||
                  isConfirmingLiquidity
                    ? {}
                    : { scale: 1.02 }
                }
                whileTap={
                  !isConnected ||
                  !isArcTestnet ||
                  !amountA ||
                  !amountB ||
                  parseFloat(amountA) <= 0 ||
                  parseFloat(amountB) <= 0 ||
                  isCreating ||
                  isConfirmingCreate ||
                  isAddingLiquidity ||
                  isConfirmingLiquidity
                    ? {}
                    : { scale: 0.98 }
                }
              >
                {(isCreating || isConfirmingCreate || isAddingLiquidity || isConfirmingLiquidity) && (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                )}
                <span className="hidden sm:inline">
                  {poolExists
                    ? isAddingLiquidity || isConfirmingLiquidity
                      ? 'Adding Liquidity...'
                      : 'Add Liquidity'
                    : isCreating || isConfirmingCreate
                    ? 'Creating Pool...'
                    : liquiditySuccess
                    ? 'Completed!'
                    : 'Create Pool & Add Liquidity'}
                </span>
                <span className="sm:hidden">
                  {poolExists
                    ? isAddingLiquidity || isConfirmingLiquidity
                      ? 'Adding...'
                      : 'Add'
                    : isCreating || isConfirmingCreate
                    ? 'Creating...'
                    : liquiditySuccess
                    ? 'Done!'
                    : 'Create'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {(error || writeError) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Error</p>
              <p className="text-xs mt-1">{error || writeError?.message || 'Unknown error'}</p>
            </div>
          </motion.div>
        )}

        {/* Success Message */}
        {liquiditySuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200 flex items-start gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Success!</p>
              <p className="text-xs mt-1">
                {poolExists ? 'Liquidity added successfully!' : 'Pool created and liquidity added successfully!'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress Modal */}
        <AnimatePresence>
          {showProgressModal && !modalManuallyClosed && (
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
                  (!isAddingLiquidity && !isConfirmingLiquidity && !isCreating && !isConfirmingCreate && 
                   (approvalStep === 'none' || (transactionSuccess && approvalStep === 'adding')));
                if (canClose) {
                  setShowProgressModal(false);
                  setApprovalStep('none');
                  setLiquiditySuccess(false);
                  setErrorMessage(null);
                  setHasStartedPostCreationFlow(false);
                  setCompletedApprovalStep('none');
                  setCompletedSteps(new Set()); // Reset completed steps
                  setModalManuallyClosed(true); // Mark as manually closed to prevent reopening
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
                    (transactionSuccess && approvalStep === 'adding' && !isAddingLiquidity && !isConfirmingLiquidity) ||
                    (!isAddingLiquidity && !isConfirmingLiquidity && !isCreating && !isConfirmingCreate && !poolCreated && approvalStep === 'none')) && (
                    <button
                      onClick={() => {
                        setShowProgressModal(false);
                        setApprovalStep('none');
                        setLiquiditySuccess(false);
                        setErrorMessage(null);
                        setHasStartedPostCreationFlow(false);
                        setCompletedApprovalStep('none');
                      setCompletedSteps(new Set());
                        setAmountA('');
                        setAmountB('');
                      setModalManuallyClosed(true);
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
                  {!poolExists ? 'Creating Pool' : 'Adding Liquidity'}
                </motion.h3>

                <div className="space-y-4">

                  {/* Step 1: Create Pool (if creating new pool) */}
                  {(!poolExists && (isCreating || isConfirmingCreate || poolCreated || approvalStep !== 'none')) && (
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
                        {(isCreating || isConfirmingCreate) ? (
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
                          ) : completedSteps.has('createPool') || poolCreated ? (
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
                          isCreating || isConfirmingCreate
                            ? 'text-orange-600'
                              : completedSteps.has('createPool') || poolCreated
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}>
                          Create Pool
                        </p>
                          <p className="text-xs text-gray-500 mt-1">
                          {(isCreating || isConfirmingCreate) 
                            ? 'Confirm in wallet...' 
                              : completedSteps.has('createPool') || poolCreated
                            ? 'Completed'
                            : 'Pending'}
                        </p>
                      </div>
                    </div>
                    </motion.div>
                  )}

                  {/* Step 2: Approve Token A */}
                  {(approvalStep === 'approvingA' || approvalStep === 'approvingB' || approvalStep === 'adding') && (
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
                        {approvalStep === 'approvingA' && (isAddingLiquidity || isConfirmingLiquidity) ? (
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
                          approvalStep === 'approvingA' && (isAddingLiquidity || isConfirmingLiquidity)
                            ? 'text-orange-600'
                              : completedSteps.has('approvingA') || approvalStep !== 'approvingA'
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}>
                          Approve {symbolA || 'Token A'}
                        </p>
                          <p className="text-xs text-gray-500 mt-1">
                          {approvalStep === 'approvingA' && (isAddingLiquidity || isConfirmingLiquidity) 
                            ? 'Confirm in wallet...' 
                              : completedSteps.has('approvingA') || approvalStep !== 'approvingA'
                            ? 'Completed'
                            : 'Pending'}
                        </p>
                      </div>
                    </div>
                    </motion.div>
                  )}

                  {/* Step 3: Approve Token B */}
                  {(approvalStep === 'approvingB' || approvalStep === 'adding') && (
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
                        {approvalStep === 'approvingB' && (isAddingLiquidity || isConfirmingLiquidity || isCreating || isConfirmingCreate) ? (
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
                          approvalStep === 'approvingB' && (isAddingLiquidity || isConfirmingLiquidity || isCreating || isConfirmingCreate)
                            ? 'text-orange-600'
                              : completedSteps.has('approvingB') || approvalStep === 'adding'
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}>
                          Approve {symbolB || 'Token B'}
                        </p>
                          <p className="text-xs text-gray-500 mt-1">
                          {approvalStep === 'approvingB' && (isAddingLiquidity || isConfirmingLiquidity || isCreating || isConfirmingCreate) 
                            ? 'Confirm in wallet...' 
                              : completedSteps.has('approvingB') || approvalStep === 'adding'
                            ? 'Completed'
                            : 'Pending'}
                        </p>
                      </div>
                    </div>
                    </motion.div>
                  )}

                  {/* Step 4: Add Liquidity */}
                  {(approvalStep === 'adding' || (approvalStep !== 'none' && (isAddingLiquidity || isConfirmingLiquidity || transactionSuccess))) && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
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
                        {approvalStep === 'adding' && (isAddingLiquidity || isConfirmingLiquidity) ? (
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
                          ) : completedSteps.has('adding') || (transactionSuccess && approvalStep === 'adding') ? (
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
                          approvalStep === 'adding' && (isAddingLiquidity || isConfirmingLiquidity)
                            ? 'text-orange-600'
                              : completedSteps.has('adding') || (transactionSuccess && approvalStep === 'adding')
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`}>
                          Add Liquidity
                        </p>
                          <p className="text-xs text-gray-500 mt-1">
                          {approvalStep === 'adding' && (isAddingLiquidity || isConfirmingLiquidity) 
                            ? 'Confirm in wallet...' 
                              : completedSteps.has('adding') || (transactionSuccess && approvalStep === 'adding')
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
                          {poolExists ? 'Liquidity added successfully' : 'Pool created and liquidity added successfully'}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm rounded-xl border border-red-200"
                      style={{
                        boxShadow: `
                          inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                          inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                        `,
                      }}
                    >
                      <div className="flex items-center gap-2 justify-center">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-sm font-medium text-red-800">
                          {errorMessage}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unauthorized Wallet Modal */}
        <AnimatePresence>
          {showUnauthorizedModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={() => setShowUnauthorizedModal(false)}
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
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-orange-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {unauthorizedModalType === 'usdc' ? 'Insufficient USDC Balance' : 'Insufficient Token Balance'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowUnauthorizedModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                    {unauthorizedModalType === 'usdc' ? (
                      <>
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">
                          To create a liquidity pool with USDC, you need a minimum balance of <span className="font-semibold text-orange-600">{MIN_USDC_BALANCE.toLocaleString()} USDC</span>.
                        </p>
                        {isConnected && (
                          <div className="mt-3 pt-3 border-t border-orange-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Your USDC Balance:</span>
                              <span className={`text-sm font-semibold ${parseFloat(usdcBalanceFormatted) >= MIN_USDC_BALANCE ? 'text-green-600' : 'text-orange-600'}`}>
                                {parseFloat(usdcBalanceFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                              </span>
                            </div>
                            {parseFloat(usdcBalanceFormatted) < MIN_USDC_BALANCE && (
                              <div className="mt-2 text-xs text-orange-600">
                                You need {((MIN_USDC_BALANCE - parseFloat(usdcBalanceFormatted)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} more USDC to create a pool.
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">
                          To create an ERC20-ERC20 liquidity pool, you need a minimum balance of <span className="font-semibold text-orange-600">{MIN_ERC20_BALANCE.toLocaleString()} tokens</span> of either token in the pair.
                        </p>
                        {isConnected && nonUSDCToken && (
                          <div className="mt-3 pt-3 border-t border-orange-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Token A Balance:</span>
                              <span className={`text-sm font-semibold ${parseFloat(balanceAFinal) >= MIN_ERC20_BALANCE ? 'text-green-600' : 'text-orange-600'}`}>
                                {parseFloat(balanceAFinal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbolA || 'Token A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Token B Balance:</span>
                              <span className={`text-sm font-semibold ${parseFloat(balanceBFinal) >= MIN_ERC20_BALANCE ? 'text-green-600' : 'text-orange-600'}`}>
                                {parseFloat(balanceBFinal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbolB || 'Token B'}
                              </span>
                            </div>
                            {parseFloat(balanceAFinal) < MIN_ERC20_BALANCE && parseFloat(balanceBFinal) < MIN_ERC20_BALANCE && (
                              <div className="mt-2 text-xs text-orange-600">
                                You need at least {MIN_ERC20_BALANCE.toLocaleString()} of either token to create a pool.
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 text-center">
                    This requirement helps ensure pools are created with sufficient initial liquidity.
                  </p>

                  <motion.button
                    onClick={() => setShowUnauthorizedModal(false)}
                    className="w-full py-3 rounded-xl font-semibold text-base bg-orange-500 text-white hover:bg-orange-600 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Understood
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
