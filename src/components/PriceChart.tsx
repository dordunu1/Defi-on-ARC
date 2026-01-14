import { useEffect, useRef, useState, useMemo } from 'react';
import { AreaSeries, createChart, ColorType, type ISeriesApi, CrosshairMode } from 'lightweight-charts';
import { usePriceHistory, type PriceDataPoint } from '../hooks/usePriceHistory';
import { usePoolMetrics } from '../hooks/usePoolMetrics';
import { type TokenSymbol, usePoolAddress, TOKENS } from '../hooks/useDEX';
import { type Address, isAddress } from 'viem';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface PriceChartProps {
  fromToken: TokenSymbol | Address;
  toToken: TokenSymbol | Address;
  poolAddress: Address | null;
  swapPath?: TokenSymbol[] | null; // For multi-hop swaps
  height?: number;
}

export default function PriceChart({
  fromToken,
  toToken,
  poolAddress,
  swapPath,
  height = 300,
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<'1H' | '1D' | '1W' | '1M'>('1D');
  const [chartReady, setChartReady] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  
  // Helper function to check if a token is USDC
  const isUSDC = (token: TokenSymbol | Address): boolean => {
    if (typeof token === 'string' && token === 'USDC') return true;
    if (typeof token === 'string' && isAddress(token)) {
      const usdcAddr = TOKENS.USDC.address.toLowerCase();
      return token.toLowerCase() === usdcAddr;
    }
    return false;
  };
  
  // Helper function to get token symbol or address
  const getTokenSymbolOrAddress = (token: TokenSymbol | Address): TokenSymbol | Address => {
    if (typeof token === 'string' && token.length <= 5 && TOKENS[token as TokenSymbol]) {
      return token as TokenSymbol;
    }
    return token;
  };
  
  // Normalize tokens to always show Token/USDC price
  // Find the non-USDC token and use it as the base, USDC as the quote
  const normalizedTokens = useMemo(() => {
    const fromTokenNormalized = getTokenSymbolOrAddress(fromToken);
    const toTokenNormalized = getTokenSymbolOrAddress(toToken);
    
    const fromIsUSDC = isUSDC(fromTokenNormalized);
    const toIsUSDC = isUSDC(toTokenNormalized);
    
    // If both are USDC, return null (shouldn't happen)
    if (fromIsUSDC && toIsUSDC) {
      return { 
        chartFromToken: 'USDC' as TokenSymbol, 
        chartToToken: 'USDC' as TokenSymbol, 
        displayPoolAddress: null,
        displayFromToken: 'USDC' as TokenSymbol,
        displayToToken: 'USDC' as TokenSymbol,
      };
    }
    
    // If fromToken is USDC, use toToken/USDC
    if (fromIsUSDC && !toIsUSDC) {
      // Check if toToken is a TokenSymbol or Address
      const isTokenSymbol = typeof toTokenNormalized === 'string' && 
                            toTokenNormalized.length <= 5 && 
                            TOKENS[toTokenNormalized as TokenSymbol];
      const tokenSymbol: TokenSymbol = isTokenSymbol 
        ? (toTokenNormalized as TokenSymbol)
        : 'USDC'; // Fallback, but this shouldn't happen
      
      return {
        chartFromToken: tokenSymbol,
        chartToToken: 'USDC' as TokenSymbol,
        displayPoolAddress: poolAddress,
        displayFromToken: tokenSymbol,
        displayToToken: 'USDC' as TokenSymbol,
      };
    }
    
    // If toToken is USDC, use fromToken/USDC
    if (!fromIsUSDC && toIsUSDC) {
      // Check if fromToken is a TokenSymbol or Address
      const isTokenSymbol = typeof fromTokenNormalized === 'string' && 
                            fromTokenNormalized.length <= 5 && 
                            TOKENS[fromTokenNormalized as TokenSymbol];
      const tokenSymbol: TokenSymbol = isTokenSymbol 
        ? (fromTokenNormalized as TokenSymbol)
        : 'USDC'; // Fallback, but this shouldn't happen
      
      return {
        chartFromToken: tokenSymbol,
        chartToToken: 'USDC' as TokenSymbol,
        displayPoolAddress: poolAddress,
        displayFromToken: tokenSymbol,
        displayToToken: 'USDC' as TokenSymbol,
      };
    }
    
    // If neither is USDC, try to find USDC pool for fromToken
    // For multi-hop swaps, use the first hop that involves USDC
    const isMultiHop = swapPath && Array.isArray(swapPath) && swapPath.length > 2;
    
    if (isMultiHop && swapPath) {
      // Find first token that's not USDC in the path
      for (let i = 0; i < swapPath.length - 1; i++) {
        if (swapPath[i] !== 'USDC' && swapPath[i + 1] === 'USDC') {
          return {
            chartFromToken: swapPath[i] as TokenSymbol,
            chartToToken: 'USDC' as TokenSymbol,
            displayPoolAddress: null, // Will be calculated below
            displayFromToken: swapPath[i] as TokenSymbol,
            displayToToken: 'USDC' as TokenSymbol,
          };
        }
        if (swapPath[i] === 'USDC' && swapPath[i + 1] !== 'USDC') {
          return {
            chartFromToken: swapPath[i + 1] as TokenSymbol,
            chartToToken: 'USDC' as TokenSymbol,
            displayPoolAddress: null, // Will be calculated below
            displayFromToken: swapPath[i + 1] as TokenSymbol,
            displayToToken: 'USDC' as TokenSymbol,
          };
        }
      }
    }
    
    // Default: use fromToken/USDC (try to find USDC pool)
    // Check if fromToken is a TokenSymbol
    const isTokenSymbol = typeof fromTokenNormalized === 'string' && 
                          fromTokenNormalized.length <= 5 && 
                          TOKENS[fromTokenNormalized as TokenSymbol];
    const tokenSymbol: TokenSymbol = isTokenSymbol 
      ? (fromTokenNormalized as TokenSymbol)
      : 'USDC'; // Fallback
    
    return {
      chartFromToken: tokenSymbol,
      chartToToken: 'USDC' as TokenSymbol,
      displayPoolAddress: null, // Will be calculated below
      displayFromToken: tokenSymbol,
      displayToToken: 'USDC' as TokenSymbol,
    };
  }, [fromToken, toToken, poolAddress, swapPath]);
  
  // Get pool address for the normalized token pair
  const normalizedPoolAddress = usePoolAddress(
    normalizedTokens.chartFromToken,
    normalizedTokens.chartToToken
  );
  
  // Use the normalized pool address if we don't have one from props
  const displayPoolAddress = normalizedTokens.displayPoolAddress || normalizedPoolAddress;
  const chartFromToken = normalizedTokens.chartFromToken;
  const chartToToken = normalizedTokens.chartToToken;
  const displayFromToken = normalizedTokens.displayFromToken;
  const displayToToken = normalizedTokens.displayToToken;
  
  const { priceData, isLoading, error } = usePriceHistory(chartFromToken, chartToToken, displayPoolAddress, timeRange);
  const { metrics: poolMetrics, isLoading: metricsLoading } = usePoolMetrics(chartFromToken, chartToToken, displayPoolAddress);
  
  // Get current price from latest data point
  const currentPrice = useMemo(() => {
    if (priceData.length > 0) {
      return priceData[priceData.length - 1].value;
    }
    return poolMetrics?.currentPrice || 0;
  }, [priceData, poolMetrics?.currentPrice]);
  
  // Calculate percentage change for the selected timeframe
  const timeframePriceChange = useMemo(() => {
    if (priceData.length < 2 || currentPrice === 0) {
      return null;
    }
    
    // Get the first (earliest) price point in the current timeframe
    // priceData is sorted by time ascending, so [0] is the earliest
    let firstPrice = priceData[0].value;
    
    // If first price is invalid or same as current, try to find earliest valid different price
    if (firstPrice === 0 || Math.abs(firstPrice - currentPrice) < 0.0001) {
      // Look for the first non-zero price that's meaningfully different from current
      for (let i = 0; i < priceData.length; i++) {
        const price = priceData[i].value;
        if (price > 0 && Math.abs(price - currentPrice) >= 0.0001) {
          firstPrice = price;
          break;
        }
      }
      
      // If still no valid price found, return null
      if (firstPrice === 0 || Math.abs(firstPrice - currentPrice) < 0.0001) {
        return null;
      }
    }
    
    // Calculate percentage change from earliest to current
    const change = ((currentPrice - firstPrice) / firstPrice) * 100;
    
    // Handle very large changes (like from 0.0068 to 2.99 = ~43,900%)
    return change;
  }, [priceData, currentPrice, timeRange]);
  
  // Format volume
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  };

  // Initialize chart when container becomes available
  // This effect needs to run whenever the container might become available
  useEffect(() => {
    // Don't initialize if we don't have required props
    if (!displayPoolAddress || isLoading || error) {
      return;
    }

    // If chart already exists, just mark it ready
    if (chartRef.current && seriesRef.current) {
      setChartReady(true);
      return;
    }

    let handleResize: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 10;

    // Wait for container to be available
    const initChart = () => {
      if (!chartContainerRef.current) {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          timeoutId = setTimeout(() => {
            initChart();
          }, 100);
        }
        return false;
      }

      // Double check chart wasn't created
      if (chartRef.current && seriesRef.current) {
        setChartReady(true);
        return true;
      }

      const containerWidth = chartContainerRef.current.clientWidth || 400;
      if (containerWidth === 0) {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          timeoutId = setTimeout(() => {
            initChart();
          }, 100);
        }
        return false;
      }

      try {
        // Create chart with TradingView-like styling
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: '#ffffff' },
            textColor: '#333333',
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          },
          width: containerWidth,
          height: height,
          grid: {
            vertLines: {
              color: '#f0f0f0',
              style: 0,
              visible: true,
            },
            horzLines: {
              color: '#f0f0f0',
              style: 0,
              visible: true,
            },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: '#758696',
              width: 1,
              style: 3,
              labelBackgroundColor: '#fb923c',
            },
            horzLine: {
              color: '#758696',
              width: 1,
              style: 3,
              labelBackgroundColor: '#fb923c',
            },
          },
          rightPriceScale: {
            borderColor: '#e0e0e0',
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
            autoScale: true,
            entireTextOnly: false,
          },
          timeScale: {
            borderColor: '#e0e0e0',
            timeVisible: true,
            secondsVisible: timeRange === '1H',
            fixLeftEdge: false,
            fixRightEdge: true,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            barSpacing: 8,
            minBarSpacing: 0.5,
          },
        });

        // Add area series with improved styling
        const areaSeries = chart.addSeries(AreaSeries, {
          lineColor: '#fb923c',
          topColor: 'rgba(251, 146, 60, 0.25)',
          bottomColor: 'rgba(251, 146, 60, 0.05)',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          priceFormat: {
            type: 'price',
            precision: 4,
            minMove: 0.0001,
          },
        });

        chartRef.current = chart;
        seriesRef.current = areaSeries;

        // Handle resize
        handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            const newWidth = chartContainerRef.current.clientWidth || 400;
            chartRef.current.applyOptions({
              width: newWidth,
            });
          }
        };

        window.addEventListener('resize', handleResize);

        // Mark chart as ready
        setChartReady(true);
        return true;
      } catch (error) {
        return false;
      }
    };

    // Start initialization attempt
    initChart();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      setChartReady(false);
    };
  }, [displayPoolAddress, isLoading, error, height]); // Re-run when container becomes available

  // Update chart height when height prop changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        height: height,
      });
    }
  }, [height]);

  // Update chart data when priceData changes OR when chart becomes ready
  useEffect(() => {
    // Only proceed if chart is ready AND series exists
    if (!chartReady || !seriesRef.current || !chartRef.current) {
      return;
    }

    // Double-check refs are still valid (race condition protection)
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) {
      return;
    }

    if (priceData.length > 0) {
      // Transform data for TradingView format - ensure correct types
      const chartData = priceData.map((point) => {
        // Ensure time is in correct format (number for timestamps, string for dates)
        let time = point.time;
        if (typeof time === 'string' && time.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Date string format - TradingView accepts this
          time = time as any;
        } else if (typeof time === 'number') {
          // Unix timestamp - ensure it's a number
          time = time as any;
        }
        
        return {
          time: time,
          value: point.value,
        };
      });

      try {
        series.setData(chartData);
        
        // Fit content to show all data
        chart.timeScale().fitContent();
      } catch (error: any) {
        // Silent fail - chart will retry on next update
      }
    } else if (priceData.length === 0 && chartReady) {
      // Clear data if empty (only if chart is ready to avoid errors)
      try {
        series.setData([]);
      } catch (error) {
        // Silent fail
      }
    }
  }, [priceData, chartReady, timeRange]);

  if (!displayPoolAddress) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm text-gray-500">No pool found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-xl border border-gray-200">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full relative bg-white rounded-xl border border-gray-200 p-4">
      {/* Header with pair name, price, volume, and percentage change */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {displayFromToken} / {displayToToken}
        </h3>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Current Price */}
              <div>
                <span className="text-2xl font-bold text-gray-900">
                  {currentPrice > 0 ? `$${currentPrice.toFixed(4)}` : '--'}
                </span>
              </div>
              
              {/* Timeframe-specific Change */}
              {timeframePriceChange !== null && (
                <div className="flex items-center gap-1">
                  {timeframePriceChange > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : timeframePriceChange < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  ) : null}
                  <span
                    className={`text-sm font-medium ${
                      timeframePriceChange > 0 
                        ? 'text-green-600' 
                        : timeframePriceChange < 0 
                        ? 'text-red-600' 
                        : 'text-gray-600'
                    }`}
                  >
                    {timeframePriceChange > 0 ? '+' : ''}
                    {timeframePriceChange.toFixed(2)}%
                  </span>
                </div>
              )}
              
              {/* 24h Volume */}
              {!metricsLoading && poolMetrics && (
                <div className="text-sm text-gray-600 whitespace-nowrap">
                  <span className="font-medium">24h Vol:</span>{' '}
                  <span className="text-gray-900">
                    {poolMetrics.volume24h > 0 ? formatVolume(poolMetrics.volume24h) : '$0.00'}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">(updates hourly)</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['1H', '1D', '1W', '1M'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                timeRange === range
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      </div>
      
      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full relative" style={{ height: `${Math.max(height, 350)}px` }} />
      
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      )}
      
      {/* Empty State */}
      {priceData.length === 0 && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-gray-500 bg-white/90 px-3 py-1 rounded">No price data available yet</p>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}

