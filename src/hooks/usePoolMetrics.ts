import { useState, useEffect } from 'react';
import { type Address } from 'viem';
import { type TokenSymbol } from './useDEX';

interface PoolMetrics {
  totalTVL: number;
  totalVolume: number;
  isLoading: boolean;
}

interface PoolSpecificMetrics {
  metrics: {
    currentPrice: number;
    volume24h: number;
  } | null;
  isLoading: boolean;
}

// Overload for pool-specific metrics
export function usePoolMetrics(
  tokenA: TokenSymbol | Address | null | undefined,
  tokenB: TokenSymbol | Address | null | undefined,
  poolAddress: Address | null | undefined
): PoolSpecificMetrics;

// Overload for aggregate metrics
export function usePoolMetrics(): PoolMetrics;

// Implementation
export function usePoolMetrics(
  tokenA?: TokenSymbol | Address | null | undefined,
  tokenB?: TokenSymbol | Address | null | undefined,
  poolAddress?: Address | null | undefined
): PoolMetrics | PoolSpecificMetrics {
  // If parameters provided, return pool-specific metrics
  if (tokenA !== undefined && tokenB !== undefined && poolAddress !== undefined) {
    return usePoolSpecificMetrics(tokenA, tokenB, poolAddress);
  }
  
  // Otherwise return aggregate metrics
  return useAggregateMetrics();
}

function useAggregateMetrics(): PoolMetrics {
  const [totalTVL, setTotalTVL] = useState<number>(0);
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

    if (!supabaseUrl || !supabaseKey) {
      setIsLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      try {
        const usdcAddress = USDC_ADDRESS.toLowerCase();

        // Fetch total TVL from pools
        const poolsResponse = await fetch(`${supabaseUrl}/rest/v1/pools?select=total_liquidity`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });

        if (poolsResponse.ok) {
          const poolsData = await poolsResponse.json();
          const tvl = poolsData.reduce((sum: number, pool: any) => {
            return sum + (parseFloat(pool.total_liquidity || 0));
          }, 0);
          setTotalTVL(tvl);
        }

        // Fetch total volume
        const volumeResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_total_volume_fees`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ usdc_address: usdcAddress }),
          }
        );

        if (volumeResponse.ok) {
          const volumeData = await volumeResponse.json();
          setTotalVolume(volumeData[0]?.total_volume || 0);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching pool metrics:', error);
        setIsLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { totalTVL, totalVolume, isLoading };
}

function usePoolSpecificMetrics(
  tokenA: TokenSymbol | Address | null | undefined,
  tokenB: TokenSymbol | Address | null | undefined,
  poolAddress: Address | null | undefined
): PoolSpecificMetrics {
  const [metrics, setMetrics] = useState<{ currentPrice: number; volume24h: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!poolAddress || !tokenA || !tokenB) {
      setIsLoading(false);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      setIsLoading(false);
      return;
    }

    const fetchPoolMetrics = async () => {
      try {
        const poolAddressLower = poolAddress.toLowerCase();
        
        // Fetch 24h volume for this specific pool
        const volumeResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_pool_volume_24h`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pool_address_param: poolAddressLower }),
          }
        );

        let volume24h = 0;
        if (volumeResponse.ok) {
          const volumeData = await volumeResponse.json();
          volume24h = parseFloat(volumeData[0]?.volume_24h || 0);
        }

        // Fetch current price from pool reserves
        const poolResponse = await fetch(
          `${supabaseUrl}/rest/v1/pools?pool_address=eq.${poolAddressLower}&select=reserve_a,reserve_b,reserve_a_decimals,reserve_b_decimals`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        let currentPrice = 0;
        if (poolResponse.ok) {
          const poolData = await poolResponse.json();
          if (poolData.length > 0 && poolData[0].reserve_a && poolData[0].reserve_b) {
            const reserveA = parseFloat(poolData[0].reserve_a) / Math.pow(10, poolData[0].reserve_a_decimals || 18);
            const reserveB = parseFloat(poolData[0].reserve_b) / Math.pow(10, poolData[0].reserve_b_decimals || 18);
            if (reserveB > 0) {
              currentPrice = reserveA / reserveB;
            }
          }
        }

        setMetrics({ currentPrice, volume24h });
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching pool-specific metrics:', error);
        setIsLoading(false);
      }
    };

    fetchPoolMetrics();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchPoolMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [tokenA, tokenB, poolAddress]);

  return { metrics, isLoading };
}
