import { useState, useEffect } from 'react';
import { type Address } from 'viem';
import { TOKENS, type TokenSymbol } from './useDEX';

export interface PoolMetrics {
  volume24h: number;
  priceChange24h: number; // Percentage change
  priceChange24hAbs: number; // Absolute price change
  currentPrice: number;
  price24hAgo: number | null;
}

/**
 * Hook to fetch 24h volume and calculate 24h price change for a pool
 */
export function usePoolMetrics(
  fromToken: TokenSymbol,
  toToken: TokenSymbol,
  poolAddress: Address | null
) {
  const [metrics, setMetrics] = useState<PoolMetrics>({
    volume24h: 0,
    priceChange24h: 0,
    priceChange24hAbs: 0,
    currentPrice: 0,
    price24hAgo: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poolAddress || !fromToken || !toToken) {
      setMetrics({
        volume24h: 0,
        priceChange24h: 0,
        priceChange24hAbs: 0,
        currentPrice: 0,
        price24hAgo: null,
      });
      return;
    }

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchMetrics = async (isBackgroundPoll = false) => {
      // Only show loading on initial load, not on background polls
      if (!isBackgroundPoll) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
          setError('Supabase not configured');
          setIsLoading(false);
          return;
        }

        const fromTokenAddr = TOKENS[fromToken].address.toLowerCase();
        const toTokenAddr = TOKENS[toToken].address.toLowerCase();
        const poolAddr = poolAddress.toLowerCase();
        const usdcAddr = TOKENS.USDC.address.toLowerCase();

        // Calculate 24 hours ago (always use current time to get rolling 24h window)
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Fetch swap events from last 24 hours (rolling window)
        // Limit to 1500 events to balance egress reduction with accurate 24h volume calculation
        const swapEventsResponse = await fetch(
          `${supabaseUrl}/rest/v1/swap_events?pool_address=eq.${poolAddr}&timestamp=gte.${twentyFourHoursAgo.toISOString()}&select=token_in,token_out,amount_in,amount_out,timestamp&order=timestamp.desc&limit=1500`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        if (!swapEventsResponse.ok) {
          throw new Error('Failed to fetch swap events');
        }

        const swapEvents = await swapEventsResponse.json();

        // Calculate 24h volume (in USD)
        let volume24h = 0;
        for (const event of swapEvents) {
          const tokenInLower = event.token_in?.toLowerCase();
          const tokenOutLower = event.token_out?.toLowerCase();

          // If USDC is involved, use USDC amount directly
          if (tokenInLower === usdcAddr) {
            volume24h += Number(event.amount_in) / 1e6; // USDC has 6 decimals
          } else if (tokenOutLower === usdcAddr) {
            volume24h += Number(event.amount_out) / 1e6; // USDC has 6 decimals
          } else {
            // For token-to-token swaps, estimate volume (simplified - could be improved with price lookup)
            // Use the larger amount as a rough estimate
            const amountIn = Number(event.amount_in) / 1e18; // Assuming 18 decimals
            const amountOut = Number(event.amount_out) / 1e18;
            volume24h += Math.max(amountIn, amountOut) * 0.5; // Rough estimate
          }
        }

        // Fetch current price and price 24h ago from price_history
        const priceHistoryResponse = await fetch(
          `${supabaseUrl}/rest/v1/price_history?pool_address=eq.${poolAddr}&timestamp=gte.${twentyFourHoursAgo.toISOString()}&select=timestamp,reserve_a,reserve_b,token_a,token_b&order=timestamp.asc`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        let currentPrice = 0;
        let price24hAgo: number | null = null;

        if (priceHistoryResponse.ok) {
          const priceHistory = await priceHistoryResponse.json();

          if (priceHistory.length > 0) {
            // Get most recent price (current)
            const latest = priceHistory[priceHistory.length - 1];
            const tokenA = latest.token_a?.toLowerCase();
            const tokenB = latest.token_b?.toLowerCase();
            
            const fromMatchesA = tokenA === fromTokenAddr;
            const fromMatchesB = tokenB === fromTokenAddr;
            
            if (fromMatchesA) {
              // fromToken is tokenA, calculate reserveB/reserveA
              const reserveA = parseFloat(latest.reserve_a) || 0;
              const reserveB = parseFloat(latest.reserve_b) || 0;
              const tokenADecimals = TOKENS[fromToken].decimals || 18;
              const tokenBDecimals = TOKENS[toToken].decimals || 18;
              const reserveAFormatted = reserveA / (10 ** tokenADecimals);
              const reserveBFormatted = reserveB / (10 ** tokenBDecimals);
              if (reserveAFormatted > 0) {
                currentPrice = reserveBFormatted / reserveAFormatted;
              }
            } else if (fromMatchesB) {
              // fromToken is tokenB, calculate reserveA/reserveB
              const reserveA = parseFloat(latest.reserve_a) || 0;
              const reserveB = parseFloat(latest.reserve_b) || 0;
              const tokenADecimals = TOKENS[toToken].decimals || 18;
              const tokenBDecimals = TOKENS[fromToken].decimals || 18;
              const reserveAFormatted = reserveA / (10 ** tokenADecimals);
              const reserveBFormatted = reserveB / (10 ** tokenBDecimals);
              if (reserveBFormatted > 0) {
                currentPrice = reserveAFormatted / reserveBFormatted;
              }
            }

            // Get price 24h ago (first entry or closest to 24h ago)
            const targetTime = twentyFourHoursAgo.getTime();
            let closestEntry = priceHistory[0];
            let minDiff = Math.abs(new Date(closestEntry.timestamp).getTime() - targetTime);

            for (const entry of priceHistory) {
              const entryTime = new Date(entry.timestamp).getTime();
              const diff = Math.abs(entryTime - targetTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestEntry = entry;
              }
            }

            // Calculate price 24h ago
            const entryTokenA = closestEntry.token_a?.toLowerCase();
            const entryTokenB = closestEntry.token_b?.toLowerCase();
            
            const entryFromMatchesA = entryTokenA === fromTokenAddr;
            const entryFromMatchesB = entryTokenB === fromTokenAddr;
            
            if (entryFromMatchesA) {
              const reserveA = parseFloat(closestEntry.reserve_a) || 0;
              const reserveB = parseFloat(closestEntry.reserve_b) || 0;
              const tokenADecimals = TOKENS[fromToken].decimals || 18;
              const tokenBDecimals = TOKENS[toToken].decimals || 18;
              const reserveAFormatted = reserveA / (10 ** tokenADecimals);
              const reserveBFormatted = reserveB / (10 ** tokenBDecimals);
              if (reserveAFormatted > 0) {
                price24hAgo = reserveBFormatted / reserveAFormatted;
              }
            } else if (entryFromMatchesB) {
              const reserveA = parseFloat(closestEntry.reserve_a) || 0;
              const reserveB = parseFloat(closestEntry.reserve_b) || 0;
              const tokenADecimals = TOKENS[toToken].decimals || 18;
              const tokenBDecimals = TOKENS[fromToken].decimals || 18;
              const reserveAFormatted = reserveA / (10 ** tokenADecimals);
              const reserveBFormatted = reserveB / (10 ** tokenBDecimals);
              if (reserveBFormatted > 0) {
                price24hAgo = reserveAFormatted / reserveBFormatted;
              }
            }
          }
        }

        // Calculate percentage change
        let priceChange24h = 0;
        let priceChange24hAbs = 0;
        if (price24hAgo !== null && price24hAgo > 0 && currentPrice > 0) {
          priceChange24hAbs = currentPrice - price24hAgo;
          priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
        }

        if (isMounted) {
          // Always update metrics, even during background polls
          // Use direct state update to ensure real-time updates
          setMetrics({
            volume24h,
            priceChange24h,
            priceChange24hAbs,
            currentPrice,
            price24hAgo,
          });
        }
      } catch (err: any) {
        if (isMounted && !isBackgroundPoll) {
          setError(err.message || 'Failed to load pool metrics');
          setMetrics({
            volume24h: 0,
            priceChange24h: 0,
            priceChange24hAbs: 0,
            currentPrice: 0,
            price24hAgo: null,
          });
        }
      } finally {
        if (isMounted && !isBackgroundPoll) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchMetrics(false);

    // Set up polling every 1 hour (background, no loading state)
    // 24h volume doesn't need frequent updates - 1 hour is sufficient for accurate metrics while reducing egress
    pollInterval = setInterval(() => {
      if (isMounted) {
        fetchMetrics(true); // Background poll
      }
    }, 60 * 60 * 1000); // 1 hour in milliseconds

    // Cleanup
    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [fromToken, toToken, poolAddress]);

  return { metrics, isLoading, error };
}

