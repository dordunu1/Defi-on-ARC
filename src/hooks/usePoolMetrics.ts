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
 * OPTIMIZED: 24h volume now comes from materialized view (includes ALL swaps, not limited to 1500)
 * This reduces egress by 99.9% while providing accurate volume data
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

        // OPTIMIZED: Fetch 24h volume from materialized view via RPC function
        // This includes ALL swaps in the 24h window (not limited to 1500 events)
        // Reads 1 row instead of scanning thousands of events = 99.9% less egress
        const volume24hResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_pool_volume_24h`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pool_address_param: poolAddr }),
          }
        );

        let volume24h = 0;
        if (volume24hResponse.ok) {
          const volumeData = await volume24hResponse.json();
          volume24h = volumeData[0]?.volume_24h || 0;
        } else {
          console.warn('Failed to fetch 24h volume from materialized view, using 0');
        }

        // Calculate 24 hours ago (always use current time to get rolling 24h window)
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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

