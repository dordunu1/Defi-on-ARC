import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { type Address } from 'viem';

interface SwapEvent {
  tx_hash: string;
  pool_address: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  timestamp: string;
  sender_address: string | null;
}

interface SwapEventsCacheContextType {
  getCachedEvents: (poolAddress: Address | null) => SwapEvent[];
  isCached: (poolAddress: Address | null) => boolean;
  isLoading: (poolAddress: Address | null) => boolean;
  preloadPool: (poolAddress: Address) => Promise<void>;
  updatePoolEvents: (poolAddress: Address, events: SwapEvent[]) => void;
}

const SwapEventsCacheContext = createContext<SwapEventsCacheContextType | undefined>(undefined);

export function SwapEventsCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Map<string, SwapEvent[]>>(new Map());
  const [loadingPools, setLoadingPools] = useState<Set<string>>(new Set());
  const preloadInProgress = useRef<Set<string>>(new Set());
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Fast fetch function - optimized for speed
  const fetchPoolEvents = useCallback(async (poolAddress: Address): Promise<SwapEvent[]> => {
    const poolAddrLower = poolAddress.toLowerCase();
    let allEvents: SwapEvent[] = [];
    let rangeStart = 0;
    const batchSize = 1000; // Fetch in batches of 1000

    while (true) {
      const rangeEnd = rangeStart + batchSize - 1;
      const response = await fetch(
        `${supabaseUrl}/rest/v1/swap_events?pool_address=eq.${poolAddrLower}&select=tx_hash,pool_address,token_in,token_out,amount_in,amount_out,timestamp,sender_address&order=timestamp.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Range': `${rangeStart}-${rangeEnd}`,
          },
        }
      );

      if (!response.ok) break;

      const events = await response.json();
      if (events.length === 0) break;

      allEvents = [...allEvents, ...events];

      // Check if we've fetched all events
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\d+-\d+\/(\d+)/);
        if (match) {
          const total = parseInt(match[1]);
          if (allEvents.length >= total) break;
        }
      }

      // If we got fewer than batchSize, we're done
      if (events.length < batchSize) break;

      rangeStart += batchSize;
    }

    return allEvents;
  }, [supabaseUrl, supabaseKey]);

  // Preload events for a pool (called on site load)
  const preloadPool = useCallback(async (poolAddress: Address) => {
    const poolAddrLower = poolAddress.toLowerCase();
    
    // Skip if already cached or currently loading
    if (cache.has(poolAddrLower) || preloadInProgress.current.has(poolAddrLower)) {
      return;
    }

    preloadInProgress.current.add(poolAddrLower);
    setLoadingPools(prev => new Set(prev).add(poolAddrLower));

    try {
      const events = await fetchPoolEvents(poolAddress);
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.set(poolAddrLower, events);
        return newCache;
      });
    } catch (error) {
      console.error(`Error preloading events for pool ${poolAddress}:`, error);
    } finally {
      preloadInProgress.current.delete(poolAddrLower);
      setLoadingPools(prev => {
        const newSet = new Set(prev);
        newSet.delete(poolAddrLower);
        return newSet;
      });
    }
  }, [cache, fetchPoolEvents]);

  // Update pool events (for new swaps)
  const updatePoolEvents = useCallback((poolAddress: Address, events: SwapEvent[]) => {
    const poolAddrLower = poolAddress.toLowerCase();
    setCache(prev => {
      const newCache = new Map(prev);
      newCache.set(poolAddrLower, events);
      return newCache;
    });
  }, []);

  // Get cached events for a pool
  const getCachedEvents = useCallback((poolAddress: Address | null): SwapEvent[] => {
    if (!poolAddress) return [];
    return cache.get(poolAddress.toLowerCase()) || [];
  }, [cache]);

  // Check if pool is cached
  const isCached = useCallback((poolAddress: Address | null): boolean => {
    if (!poolAddress) return false;
    return cache.has(poolAddress.toLowerCase());
  }, [cache]);

  // Check if pool is loading
  const isLoading = useCallback((poolAddress: Address | null): boolean => {
    if (!poolAddress) return false;
    return loadingPools.has(poolAddress.toLowerCase());
  }, [loadingPools]);

  // Preload all pools on mount (fetch pool addresses from Supabase)
  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;

    const preloadAllPools = async () => {
      try {
        // Fetch all pools from Supabase
        const response = await fetch(
          `${supabaseUrl}/rest/v1/pools?select=pool_address&order=total_liquidity.desc`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        if (response.ok) {
          const pools = await response.json();
          
          // Preload events for all pools in parallel (but limit concurrency)
          const poolAddresses = pools.map((p: any) => p.pool_address as Address);
          
          // Preload in batches of 3 to avoid overwhelming the API
          const batchSize = 3;
          for (let i = 0; i < poolAddresses.length; i += batchSize) {
            const batch = poolAddresses.slice(i, i + batchSize);
            await Promise.all(batch.map((addr: Address) => preloadPool(addr)));
          }
        }
      } catch (error) {
        console.error('Error preloading pools:', error);
      }
    };

    preloadAllPools();
  }, [supabaseUrl, supabaseKey, preloadPool]);

  return (
    <SwapEventsCacheContext.Provider
      value={{
        getCachedEvents,
        isCached,
        isLoading,
        preloadPool,
        updatePoolEvents,
      }}
    >
      {children}
    </SwapEventsCacheContext.Provider>
  );
}

export function useSwapEventsCache() {
  const context = useContext(SwapEventsCacheContext);
  if (context === undefined) {
    throw new Error('useSwapEventsCache must be used within SwapEventsCacheProvider');
  }
  return context;
}

