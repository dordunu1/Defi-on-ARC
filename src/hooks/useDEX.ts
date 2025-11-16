import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, type Address, isAddress } from 'viem';
import { DEX_CONFIG } from '../config/dex';
import { ERC20_ABI, POOL_ABI, FACTORY_ABI, ROUTER_ABI } from '../config/abis';

export type TokenSymbol = 'SRAC' | 'RACS' | 'SACS' | 'USDC' | 'EURC' | 'KITTY' | 'DOGG';

export interface TokenInfo {
  symbol: TokenSymbol;
  address: Address;
  decimals: number;
}

// USDC ERC-20 interface address on Arc Testnet (uses 6 decimals)
// Native USDC and ERC-20 interface share the same balance
// See: https://docs.arc.network/contract-addresses
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as Address;

export const TOKENS: Record<TokenSymbol, TokenInfo> = {
  SRAC: { symbol: 'SRAC', address: DEX_CONFIG.TOKENS.SRAC as Address, decimals: 18 },
  RACS: { symbol: 'RACS', address: DEX_CONFIG.TOKENS.RACS as Address, decimals: 18 },
  SACS: { symbol: 'SACS', address: DEX_CONFIG.TOKENS.SACS as Address, decimals: 18 },
  USDC: { symbol: 'USDC', address: USDC_ADDRESS, decimals: 6 }, // USDC ERC-20 uses 6 decimals
  EURC: { symbol: 'EURC', address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as Address, decimals: 6 }, // EURC uses 6 decimals
  KITTY: { symbol: 'KITTY', address: DEX_CONFIG.TOKENS.KITTY as Address, decimals: 18 },
  DOGG: { symbol: 'DOGG', address: DEX_CONFIG.TOKENS.DOGG as Address, decimals: 18 },
};

// Get pool address for a token pair from factory
export function usePoolAddress(tokenA: Address | TokenSymbol, tokenB: Address | TokenSymbol) {
  const publicClient = usePublicClient();
  
  // Convert TokenSymbol to Address if needed
  const tokenAAddr: Address | undefined = typeof tokenA === 'string' && isAddress(tokenA)
    ? tokenA
    : typeof tokenA === 'string' && TOKENS[tokenA as TokenSymbol]
    ? TOKENS[tokenA as TokenSymbol].address
    : undefined;
    
  const tokenBAddr: Address | undefined = typeof tokenB === 'string' && isAddress(tokenB)
    ? tokenB
    : typeof tokenB === 'string' && TOKENS[tokenB as TokenSymbol]
    ? TOKENS[tokenB as TokenSymbol].address
    : undefined;

  // Sort tokens by address (factory stores pools with lower address first)
  const [sortedTokenA, sortedTokenB] = tokenAAddr && tokenBAddr
    ? tokenAAddr.toLowerCase() < tokenBAddr.toLowerCase()
      ? [tokenAAddr, tokenBAddr]
      : [tokenBAddr, tokenAAddr]
    : [tokenAAddr, tokenBAddr];

  const { data: poolAddress } = useReadContract({
    address: DEX_CONFIG.FACTORY_ADDRESS as Address,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: sortedTokenA && sortedTokenB ? [sortedTokenA, sortedTokenB] : undefined,
    query: { enabled: !!sortedTokenA && !!sortedTokenB && !!publicClient },
  });

  return (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') 
    ? (poolAddress as Address) 
    : null;
}

// Synchronous version for use in callbacks (requires publicClient)
export async function getPoolAddress(
  tokenA: Address | TokenSymbol,
  tokenB: Address | TokenSymbol,
  publicClient: any
): Promise<Address | null> {
  // Convert TokenSymbol to Address if needed
  const tokenAAddr: Address = typeof tokenA === 'string' && isAddress(tokenA)
    ? tokenA
    : typeof tokenA === 'string' && TOKENS[tokenA as TokenSymbol]
    ? TOKENS[tokenA as TokenSymbol].address
    : tokenA as Address;
    
  const tokenBAddr: Address = typeof tokenB === 'string' && isAddress(tokenB)
    ? tokenB
    : typeof tokenB === 'string' && TOKENS[tokenB as TokenSymbol]
    ? TOKENS[tokenB as TokenSymbol].address
    : tokenB as Address;

  if (!publicClient) return null;

  // Sort tokens by address (factory stores pools with lower address first)
  const [sortedTokenA, sortedTokenB] = tokenAAddr.toLowerCase() < tokenBAddr.toLowerCase()
    ? [tokenAAddr, tokenBAddr]
    : [tokenBAddr, tokenAAddr];

  try {
    const poolAddress = await publicClient.readContract({
      address: DEX_CONFIG.FACTORY_ADDRESS as Address,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [sortedTokenA, sortedTokenB],
    }) as Address;

    return (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') 
      ? poolAddress 
      : null;
  } catch (error) {
    return null;
  }
}

export function useDEX() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Approve token for swap (separate function)
  const approveForSwap = useCallback((token: TokenSymbol | Address, poolAddress: Address) => {
    if (!address || !isConnected) throw new Error('Wallet not connected');
    
    // Handle both TokenSymbol and Address
    const tokenAddress: Address = typeof token === 'string' && isAddress(token)
      ? token as Address
      : TOKENS[token as TokenSymbol]?.address;
    
    if (!tokenAddress) throw new Error('Invalid token address');
    
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    try {
      writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [poolAddress, maxApproval],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || 
          errorStr.includes('User denied') || 
          errorStr.includes('rejected the request') ||
          errorStr.includes('denied transaction signature')) {
        throw new Error('User rejected approval');
      }
      throw err;
    }
  }, [address, isConnected, writeContract]);

  // Find swap path (direct or via USDC)
  const findSwapPath = useCallback(async (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol
  ): Promise<Address[]> => {
    if (!publicClient) throw new Error('Public client not available');
    
    const tokenAAddr = TOKENS[tokenA].address;
    const tokenBAddr = TOKENS[tokenB].address;
    
    // Check direct pool first
    const directPool = await getPoolAddress(tokenA, tokenB, publicClient);
    if (directPool) {
      return [tokenAAddr, tokenBAddr];
    }
    
    // Try via USDC if router is available
    if (DEX_CONFIG.ROUTER_ADDRESS) {
      try {
        const path = await publicClient.readContract({
          address: DEX_CONFIG.ROUTER_ADDRESS as Address,
          abi: ROUTER_ABI,
          functionName: 'findBestPath',
          args: [tokenAAddr, tokenBAddr],
        }) as Address[];
        return path;
      } catch (error) {
        // Router path finding failed, try manual USDC path
      }
    }
    
    // Manual path finding: try via USDC
    const usdcPool1 = await getPoolAddress(tokenA, 'USDC', publicClient);
    const usdcPool2 = await getPoolAddress('USDC', tokenB, publicClient);
    
    if (usdcPool1 && usdcPool2) {
      return [tokenAAddr, DEX_CONFIG.USDC_ADDRESS, tokenBAddr];
    }
    
    throw new Error('No swap path found. Create pools or use Router.');
  }, [publicClient]);

  // Swap tokens using Router (supports multi-hop)
  const swapViaRouter = useCallback(async (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol,
    amountIn: string,
    slippagePercent: number = 0.5
  ) => {
    if (!address || !isConnected || !publicClient) throw new Error('Wallet not connected');
    if (!DEX_CONFIG.ROUTER_ADDRESS) throw new Error('Router not deployed. Please deploy Router contract.');
    
    const tokenAInfo = TOKENS[tokenA];
    const amountInWei = parseUnits(amountIn, tokenAInfo.decimals);
    
    // Find swap path
    const path = await findSwapPath(tokenA, tokenB);
    
    // Get expected output amounts
    const amounts = await publicClient.readContract({
      address: DEX_CONFIG.ROUTER_ADDRESS as Address,
      abi: ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [amountInWei, path],
    }) as bigint[];
    
    const expectedOutput = amounts[amounts.length - 1];
    
    // Calculate minimum output with slippage protection
    const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));
    const minOutputWei = (expectedOutput * slippageMultiplier) / 10000n;
    
    if (minOutputWei === 0n) {
      throw new Error('Slippage too high or insufficient liquidity');
    }
    
    // Verify router has allowance
    const currentAllowance = await publicClient.readContract({
      address: tokenAInfo.address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address, DEX_CONFIG.ROUTER_ADDRESS as Address],
    });
    
    if (currentAllowance < amountInWei) {
      throw new Error('Insufficient allowance. Please approve Router first.');
    }
    
    // Execute router swap
    try {
      writeContract({
        address: DEX_CONFIG.ROUTER_ADDRESS as Address,
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [amountInWei, minOutputWei, path, address],
      });
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || 
          errorStr.includes('User denied') || 
          errorStr.includes('rejected the request') ||
          errorStr.includes('denied transaction signature')) {
        throw new Error('User rejected swap');
      }
      throw err;
    }
  }, [address, isConnected, writeContract, publicClient, findSwapPath]);

  // Swap tokens (tries direct pool first, falls back to router if needed)
  const swap = useCallback(async (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol,
    amountIn: string,
    slippagePercent: number = 0.5 // Default 0.5% slippage
  ) => {
    if (!address || !isConnected || !publicClient) throw new Error('Wallet not connected');
    
    // Try direct pool first
    const poolAddress = await getPoolAddress(tokenA, tokenB, publicClient);
    
    // If no direct pool, try router
    if (!poolAddress) {
      if (DEX_CONFIG.ROUTER_ADDRESS) {
        return swapViaRouter(tokenA, tokenB, amountIn, slippagePercent);
      }
      throw new Error('Pool not found. Create the pool first or deploy Router for multi-hop swaps.');
    }

    const tokenAInfo = TOKENS[tokenA];
    const tokenBInfo = TOKENS[tokenB];
    
    // CRITICAL: Read actual token addresses from pool (pool stores tokens sorted by address)
    // Pool's tokenA = lower address, tokenB = higher address
    const [poolTokenA, poolTokenB] = await Promise.all([
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
    ]) as [Address, Address];

    // Determine which swap function to use based on pool's actual token order
    // Pool.tokenA = lower address, Pool.tokenB = higher address
    const userTokenAAddr = tokenAInfo.address.toLowerCase();
    const userTokenBAddr = tokenBInfo.address.toLowerCase();
    const poolTokenAAddr = (poolTokenA as string).toLowerCase();
    const poolTokenBAddr = (poolTokenB as string).toLowerCase();

    // Check if user's tokenA matches pool's tokenA or tokenB
    const isSwappingPoolTokenA = userTokenAAddr === poolTokenAAddr;
    const isSwappingPoolTokenB = userTokenAAddr === poolTokenBAddr;

    if (!isSwappingPoolTokenA && !isSwappingPoolTokenB) {
      throw new Error('Token mismatch: Input token does not match pool tokens');
    }

    // Convert amount to wei using input token decimals
    const amountInWei = parseUnits(amountIn, tokenAInfo.decimals);

    // Verify allowance before swapping
    const currentAllowance = await publicClient.readContract({
      address: tokenAInfo.address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address, poolAddress],
    });

    if (currentAllowance < amountInWei) {
      throw new Error('Insufficient allowance. Please approve first.');
    }

    // Get pool reserves to calculate expected output
    const [contractReserveA, contractReserveB] = await Promise.all([
      publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'reserveA',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'reserveB',
      }),
    ]) as [bigint, bigint];

    // Get token decimals
    const poolTokenADecimals = await publicClient.readContract({
      address: poolTokenA,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }) as number;

    const poolTokenBDecimals = await publicClient.readContract({
      address: poolTokenB,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }) as number;

    // Calculate expected output using Uniswap V2 formula
    const reserveIn = isSwappingPoolTokenA ? contractReserveA : contractReserveB;
    const reserveOut = isSwappingPoolTokenA ? contractReserveB : contractReserveA;
    const reserveInDecimals = isSwappingPoolTokenA ? poolTokenADecimals : poolTokenBDecimals;
    const reserveOutDecimals = isSwappingPoolTokenA ? poolTokenBDecimals : poolTokenADecimals;

    // Uniswap V2 formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    const FEE_BPS = 30; // 0.3% fee
    const amountInWithFee = amountInWei * BigInt(10000 - FEE_BPS);
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 10000n) + amountInWithFee;
    const expectedOutputWei = numerator / denominator;

    // Calculate minimum output with slippage protection
    const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100)); // e.g., 9950 for 0.5% (99.5%)
    const minOutputWei = (expectedOutputWei * slippageMultiplier) / 10000n;

    if (minOutputWei === 0n) {
      throw new Error('Slippage too high or insufficient liquidity');
    }

    // Perform swap using the correct function based on pool's token order
    try {
      if (isSwappingPoolTokenA) {
        // User is swapping pool's tokenA for pool's tokenB
        writeContract({
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'swapAToB',
          args: [amountInWei, minOutputWei, address], // Min output with slippage protection
        });
      } else {
        // User is swapping pool's tokenB for pool's tokenA
        writeContract({
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'swapBToA',
          args: [amountInWei, minOutputWei, address], // Min output with slippage protection
        });
      }
    } catch (err: any) {
      const errorStr = err.message || err.toString() || '';
      if (errorStr.includes('User rejected') || 
          errorStr.includes('User denied') || 
          errorStr.includes('rejected the request') ||
          errorStr.includes('denied transaction signature')) {
        throw new Error('User rejected swap');
      }
      throw err;
    }
  }, [address, isConnected, writeContract, publicClient]);

  // Approve token for pool
  const approveToken = useCallback((token: TokenSymbol, poolAddress: Address) => {
    if (!address || !isConnected) throw new Error('Wallet not connected');
    
    const tokenInfo = TOKENS[token];
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    writeContract({
      address: tokenInfo.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [poolAddress, maxApproval],
    });
  }, [address, isConnected, writeContract]);

  // Add liquidity
  const addLiquidity = useCallback(async (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol,
    amountA: string,
    amountB: string
  ) => {
    if (!address || !isConnected || !publicClient) throw new Error('Wallet not connected');
    
    const poolAddress = await getPoolAddress(tokenA, tokenB, publicClient);
    if (!poolAddress) throw new Error('Pool not found. Create the pool first.');

    const tokenAInfo = TOKENS[tokenA];
    const tokenBInfo = TOKENS[tokenB];
    const amountAWei = parseUnits(amountA, tokenAInfo.decimals);
    const amountBWei = parseUnits(amountB, tokenBInfo.decimals);

    // Check current allowances
    const [allowanceA, allowanceB] = await Promise.all([
      publicClient.readContract({
        address: tokenAInfo.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, poolAddress],
      }),
      publicClient.readContract({
        address: tokenBInfo.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, poolAddress],
      }),
    ]);

    // Check if approvals are needed
    if (allowanceA < amountAWei) {
      throw new Error('NEED_APPROVE_A');
    }

    if (allowanceB < amountBWei) {
      throw new Error('NEED_APPROVE_B');
    }

    // Both tokens approved, proceed with adding liquidity
    writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'addLiquidity',
      args: [amountAWei, amountBWei, 0n, 0n], // 0 min amounts for simplicity
    });
  }, [address, isConnected, writeContract, publicClient]);

  // Remove liquidity
  const removeLiquidity = useCallback(async (
    tokenA: TokenSymbol,
    tokenB: TokenSymbol,
    lpAmount: string
  ) => {
    if (!address || !isConnected || !publicClient) throw new Error('Wallet not connected');
    
    const poolAddress = await getPoolAddress(tokenA, tokenB, publicClient);
    if (!poolAddress) throw new Error('Pool not found. Create the pool first.');

    // Validate LP amount - parseUnits can't handle scientific notation or very small numbers
    const lpAmountNum = parseFloat(lpAmount);
    if (isNaN(lpAmountNum) || lpAmountNum <= 0) {
      throw new Error('Invalid LP amount. Please enter a valid amount.');
    }
    
    // Convert to fixed decimal string to avoid scientific notation issues
    // Use enough decimal places (18 for LP tokens) but avoid excessive precision
    const lpAmountFixed = lpAmountNum.toFixed(18).replace(/\.?0+$/, ''); // Remove trailing zeros
    if (parseFloat(lpAmountFixed) <= 0) {
      throw new Error('LP amount is too small. Please enter a larger amount.');
    }

    let lpAmountWei: bigint;
    try {
      lpAmountWei = parseUnits(lpAmountFixed, 18);
    } catch (error: any) {
      // If parseUnits still fails, provide a better error message
      if (error.message?.includes('InvalidDecimalNumberError') || error.message?.includes('not a valid decimal')) {
        throw new Error(`InvalidDecimalNumberError: Number \`${lpAmount}\` is not a valid decimal number. Please enter a valid amount.`);
      }
      throw error;
    }

    writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'removeLiquidity',
      args: [lpAmountWei, 0n, 0n, address], // 0 min amounts, send tokens to user
    });
  }, [address, isConnected, writeContract, publicClient]);

  // Approve router for token (needed for multi-hop swaps)
  const approveRouter = useCallback((token: TokenSymbol | Address) => {
    if (!address || !isConnected) throw new Error('Wallet not connected');
    if (!DEX_CONFIG.ROUTER_ADDRESS) throw new Error('Router not deployed');
    
    // Handle both TokenSymbol and Address
    const tokenAddress: Address = typeof token === 'string' && isAddress(token)
      ? token as Address
      : TOKENS[token as TokenSymbol]?.address;
    
    if (!tokenAddress) throw new Error('Invalid token address');
    
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [DEX_CONFIG.ROUTER_ADDRESS as Address, maxApproval],
    });
  }, [address, isConnected, writeContract]);

  return {
    swap,
    swapViaRouter,
    findSwapPath,
    addLiquidity,
    removeLiquidity,
    approveToken,
    approveForSwap,
    approveRouter,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

// Hook versions for reading pool data
export function usePoolReserves(tokenA: Address | TokenSymbol, tokenB: Address | TokenSymbol) {
  const poolAddress = usePoolAddress(tokenA, tokenB);
  const publicClient = usePublicClient();
  
  // CRITICAL: Read actual token addresses from pool (pool stores tokens sorted by address)
  // Pool's tokenA = lower address, tokenB = higher address
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

  // Fetch decimals for the ACTUAL pool tokens (not function parameters!)
  const { data: tokenADecimalsRaw } = useReadContract({
    address: poolTokenA as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!poolTokenA },
  });

  const { data: tokenBDecimalsRaw } = useReadContract({
    address: poolTokenB as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!poolTokenB },
  });

  // Get decimals from TOKENS map if available, otherwise use fetched or default to 18
  const poolTokenALower = poolTokenA ? (poolTokenA as string).toLowerCase() : '';
  const poolTokenBLower = poolTokenB ? (poolTokenB as string).toLowerCase() : '';
  
  // Find token info from TOKENS map - MUST match exactly including case normalization
  const poolTokenAInfo = Object.values(TOKENS).find(t => {
    const tokenAddrLower = t.address.toLowerCase();
    return tokenAddrLower === poolTokenALower;
  });
  const poolTokenBInfo = Object.values(TOKENS).find(t => {
    const tokenAddrLower = t.address.toLowerCase();
    return tokenAddrLower === poolTokenBLower;
  });
  
  // Priority: 1) TOKENS map, 2) Fetched from contract, 3) Default 18
  // BUT: If we fetched decimals from contract, use them as fallback
  const finalTokenADecimals = poolTokenAInfo?.decimals ?? (tokenADecimalsRaw ? Number(tokenADecimalsRaw) : 18);
  const finalTokenBDecimals = poolTokenBInfo?.decimals ?? (tokenBDecimalsRaw ? Number(tokenBDecimalsRaw) : 18);
  
  // CRITICAL: Read ACTUAL token balances from ERC20 contracts (same as indexer does)
  // This is the source of truth - balances are always accurate!
  // Stored reserves might be stale if _update() wasn't called
  const { data: balanceA } = useReadContract({
    address: poolTokenA as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: poolAddress ? [poolAddress] : undefined,
    query: { enabled: !!poolAddress && !!poolTokenA },
  });

  const { data: balanceB } = useReadContract({
    address: poolTokenB as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: poolAddress ? [poolAddress] : undefined,
    query: { enabled: !!poolAddress && !!poolTokenB },
  });

  return {
    reserveA: balanceA ? formatUnits(balanceA, finalTokenADecimals) : '0',
    reserveB: balanceB ? formatUnits(balanceB, finalTokenBDecimals) : '0',
    poolAddress,
  };
}

export function useSwapOutput(tokenA: Address | TokenSymbol, tokenB: Address | TokenSymbol, amountIn: string) {
  const poolAddress = usePoolAddress(tokenA, tokenB);
  const publicClient = usePublicClient();
  
  // Get token addresses
  const tokenAAddr: Address | undefined = typeof tokenA === 'string' && isAddress(tokenA)
    ? tokenA
    : typeof tokenA === 'string' && TOKENS[tokenA as TokenSymbol]
    ? TOKENS[tokenA as TokenSymbol].address
    : undefined;

  const tokenBAddr: Address | undefined = typeof tokenB === 'string' && isAddress(tokenB)
    ? tokenB
    : typeof tokenB === 'string' && TOKENS[tokenB as TokenSymbol]
    ? TOKENS[tokenB as TokenSymbol].address
    : undefined;

  // Try Router if no direct pool exists - find path first
  const shouldUseRouter = !poolAddress && DEX_CONFIG.ROUTER_ADDRESS && tokenAAddr && tokenBAddr;
  
  // Find swap path using Router (for multi-hop) - with error handling
  const { data: routerPath, error: routerPathError, isLoading: isLoadingRouterPath, refetch: refetchRouterPath } = useReadContract({
    address: shouldUseRouter ? (DEX_CONFIG.ROUTER_ADDRESS as Address) : undefined,
    abi: ROUTER_ABI,
    functionName: 'findBestPath',
    args: tokenAAddr && tokenBAddr ? [tokenAAddr, tokenBAddr] : undefined,
    query: { 
      enabled: shouldUseRouter && !!tokenAAddr && !!tokenBAddr,
      retry: 2, // Retry twice
      retryDelay: 500, // Wait 500ms between retries
      staleTime: 0, // Don't cache - always refetch
      gcTime: 0, // Don't keep in cache
    },
  });
  
  // Check if USDC pools exist for manual path fallback (only if needed)
  const tokenASymbol = typeof tokenA === 'string' && TOKENS[tokenA as TokenSymbol] ? tokenA as TokenSymbol : null;
  const tokenBSymbol = typeof tokenB === 'string' && TOKENS[tokenB as TokenSymbol] ? tokenB as TokenSymbol : null;
  
  const usdcPool1 = usePoolAddress(
    tokenASymbol || ('USDC' as TokenSymbol),
    'USDC'
  );
  const usdcPool2 = usePoolAddress(
    'USDC',
    tokenBSymbol || ('USDC' as TokenSymbol)
  );
  
  
  // Fallback: Manual path finding via USDC - use immediately if pools exist
  const manualPath = useMemo(() => {
    if (!shouldUseRouter) return null;
    
    // If Router found a path, use it (prefer Router path)
    if (routerPath && Array.isArray(routerPath) && routerPath.length >= 2) {
      return null; // Router path exists, don't use manual
    }
    
    // If Router returned empty array (no path found), use manual path if pools exist
    // Also use manual path immediately if both USDC pools exist (don't wait for Router)
    // This ensures we can calculate output even if Router is slow or fails
    const routerReturnedEmpty = routerPath && Array.isArray(routerPath) && routerPath.length === 0;
    const routerNotFound = routerPathError || routerReturnedEmpty;
    
    if ((routerNotFound || !routerPath) && usdcPool1 && usdcPool2 && tokenAAddr && tokenBAddr) {
      return [tokenAAddr, DEX_CONFIG.USDC_ADDRESS, tokenBAddr];
    }
    
    return null;
  }, [shouldUseRouter, routerPath, routerPathError, tokenAAddr, tokenBAddr, usdcPool1, usdcPool2]);
  
  // Refetch Router path when token addresses change (to clear any cached errors)
  useEffect(() => {
    if (shouldUseRouter && tokenAAddr && tokenBAddr && !isLoadingRouterPath) {
      // Always refetch when tokens change to ensure fresh path
      const timer = setTimeout(() => {
        refetchRouterPath();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [shouldUseRouter, tokenAAddr, tokenBAddr, refetchRouterPath, isLoadingRouterPath]);
  
  // Use Router path or manual path
  const finalRouterPath = routerPath || manualPath;
  
  // Get Router output amounts for multi-hop swaps (using the found path)
  const { data: routerAmounts, error: routerAmountsError, refetch: refetchRouterAmounts } = useReadContract({
    address: shouldUseRouter && finalRouterPath ? (DEX_CONFIG.ROUTER_ADDRESS as Address) : undefined,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: finalRouterPath && tokenAAddr && amountIn && parseFloat(amountIn) > 0
      ? [parseUnits(amountIn, typeof tokenA === 'string' && TOKENS[tokenA as TokenSymbol] ? TOKENS[tokenA as TokenSymbol].decimals : 18), finalRouterPath as Address[]]
      : undefined,
    query: { 
      enabled: shouldUseRouter && !!finalRouterPath && !!tokenAAddr && !!amountIn && parseFloat(amountIn) > 0,
      retry: 3, // Increased retries
      retryDelay: 1000,
      staleTime: 0, // Don't cache - always refetch when amount changes
      gcTime: 0,
    },
  });
  
  
  // Refetch amounts when path or amount changes
  useEffect(() => {
    if (shouldUseRouter && finalRouterPath && amountIn && parseFloat(amountIn) > 0) {
      const timer = setTimeout(() => {
        refetchRouterAmounts();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldUseRouter, finalRouterPath, amountIn, refetchRouterAmounts]);
  
  // WORKAROUND: Use contract's stored reserves instead of actual balances
  // This matches what the contract will actually calculate (even if reserves are stale)
  // The contract's swap functions use stored reserves, not actual balances
  const { data: contractReserveA } = useReadContract({
    address: poolAddress || undefined,
    abi: POOL_ABI,
    functionName: 'reserveA',
    query: { enabled: !!poolAddress },
  });

  const { data: contractReserveB } = useReadContract({
    address: poolAddress || undefined,
    abi: POOL_ABI,
    functionName: 'reserveB',
    query: { enabled: !!poolAddress },
  });

  // CRITICAL: Read pool's actual tokenA and tokenB to match reserves correctly
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

  // Get decimals for pool tokens to format contract reserves
  const poolTokenAInfo = poolTokenA ? Object.values(TOKENS).find(t => 
    t.address.toLowerCase() === (poolTokenA as string).toLowerCase()
  ) : null;
  const poolTokenBInfo = poolTokenB ? Object.values(TOKENS).find(t => 
    t.address.toLowerCase() === (poolTokenB as string).toLowerCase()
  ) : null;

  const poolTokenADecimals = poolTokenAInfo?.decimals ?? 18;
  const poolTokenBDecimals = poolTokenBInfo?.decimals ?? 18;

  const tokenADecimals = typeof tokenA === 'string' && TOKENS[tokenA as TokenSymbol]
    ? TOKENS[tokenA as TokenSymbol].decimals
    : 18;
  
  const amountInValue = amountIn && !isNaN(parseFloat(amountIn)) && parseFloat(amountIn) > 0
    ? parseFloat(amountIn)
    : 0;

  // Get decimals for output token
  const tokenBDecimals = typeof tokenB === 'string' && TOKENS[tokenB as TokenSymbol]
    ? TOKENS[tokenB as TokenSymbol].decimals
    : 18;

  // CRITICAL: Determine which reserve is input and which is output based on pool's actual token order
  // poolReserves.reserveA corresponds to pool's tokenA, reserveB to pool's tokenB
  const isSwappingPoolTokenA = useMemo(() => {
    if (!tokenAAddr || !poolTokenA) return false;
    return (tokenAAddr as string).toLowerCase() === (poolTokenA as string).toLowerCase();
  }, [tokenAAddr, poolTokenA]);

  // CRITICAL: Use contract's stored reserves (what contract will actually use)
  // Not actual ERC20 balances, because contract's swap uses stored reserves!
  // OR use Router amounts for multi-hop swaps
  const calculatedAmountOut = useMemo(() => {
    // If using Router (multi-hop), use Router amounts
    if (shouldUseRouter && routerAmounts && Array.isArray(routerAmounts) && routerAmounts.length > 0) {
      const finalAmount = routerAmounts[routerAmounts.length - 1];
      return formatUnits(finalAmount as bigint, tokenBDecimals);
    }
    
    // If Router is loading or path is being calculated, return empty (UI will show loading)
    if (shouldUseRouter && (isLoadingRouterPath || (finalRouterPath && !routerAmounts))) {
      return ''; // Empty means "calculating" - will trigger UI loading state
    }
    
    // If Router path failed but we have a manual path, the routerAmounts query should handle it
    // Just return empty for now to let the query complete
    if (shouldUseRouter && manualPath && manualPath.length >= 2 && !routerAmounts) {
      return ''; // Empty means "calculating" - routerAmounts query will populate
    }
    
    // Otherwise, use direct pool calculation
    if (!amountInValue || amountInValue <= 0 || !contractReserveA || !contractReserveB || !poolTokenA || !poolTokenB) {
      return '0';
    }

    // Contract reserves are in raw wei format - need to format them
    const reserveA = parseFloat(formatUnits(contractReserveA, poolTokenADecimals));
    const reserveB = parseFloat(formatUnits(contractReserveB, poolTokenBDecimals));
    
    if (reserveA <= 0 || reserveB <= 0) {
      return '0';
    }

    // CRITICAL: Match reserves to pool's token order, not user's input order
    // Contract's reserveA = pool's tokenA, reserveB = pool's tokenB
    const reserveIn = isSwappingPoolTokenA ? reserveA : reserveB;
    const reserveOut = isSwappingPoolTokenA ? reserveB : reserveA;

    // Uniswap V2 formula with 0.3% fee (30 bps = 9970/10000)
    const FEE_BPS = 30; // 0.3%
    const amountInWithFee = amountInValue * (10000 - FEE_BPS); // 9970
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 10000) + amountInWithFee;
    const amountOut = numerator / denominator;

    return amountOut.toFixed(18); // Return as string with enough precision
  }, [
    amountInValue, 
    contractReserveA, 
    contractReserveB, 
    isSwappingPoolTokenA, 
    poolTokenA, 
    poolTokenB, 
    poolTokenADecimals, 
    poolTokenBDecimals, 
    poolAddress,
    // Router-related dependencies
    shouldUseRouter,
    routerAmounts,
    finalRouterPath,
    isLoadingRouterPath,
    manualPath,
    tokenBDecimals,
  ]);

  return calculatedAmountOut;
}

export function useLPBalance(tokenA: Address | TokenSymbol, tokenB: Address | TokenSymbol) {
  const { address, isConnected } = useAccount();
  const poolAddress = usePoolAddress(tokenA, tokenB);
  
  const { data: balance } = useReadContract({
    address: poolAddress || undefined,
    abi: POOL_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!poolAddress && !!address && isConnected },
  });

  return balance ? formatUnits(balance, 18) : '0';
}

// Separate hooks for reading data
export function useTokenBalance(token: TokenSymbol | null | undefined) {
  const { address, isConnected, chainId } = useAccount();
  const tokenInfo = token ? TOKENS[token as TokenSymbol] : null;
  const isArcTestnet = chainId === 5042002;
  
  const { data: balance } = useReadContract({
    address: tokenInfo?.address as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected && !!tokenInfo && isArcTestnet },
  });

  if (!tokenInfo || !balance) return '0';
  return formatUnits(balance, tokenInfo.decimals);
}

// Get token balance by address (for custom tokens)
export function useTokenBalanceByAddress(tokenAddress: Address | string | null | undefined, decimals: number = 18) {
  const { address, isConnected, chainId } = useAccount();
  const isArcTestnet = chainId === 5042002;
  
  const { data: balance } = useReadContract({
    address: tokenAddress as Address | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected && !!tokenAddress && isArcTestnet && isAddress(tokenAddress as string) },
  });

  if (!balance) return '0';
  return formatUnits(balance, decimals);
}

export function useTokenAllowance(token: TokenSymbol | Address, spender: Address | null) {
  const { address, isConnected } = useAccount();
  // Handle both TokenSymbol and Address
  const tokenAddress: Address | undefined = typeof token === 'string' && isAddress(token)
    ? token as Address
    : TOKENS[token as TokenSymbol]?.address;
  
  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
    query: { enabled: !!address && !!spender && isConnected && !!tokenAddress },
  });

  return allowance || 0n;
}

