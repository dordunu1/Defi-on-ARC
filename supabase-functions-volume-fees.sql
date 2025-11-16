-- Supabase SQL Functions for Volume and Fees Aggregation
-- Run this SQL in your Supabase SQL Editor to create optimized aggregation functions

-- Function to get total volume and fees (all time)
-- This aggregates all USDC amounts server-side, avoiding fetching 30k+ rows
CREATE OR REPLACE FUNCTION get_total_volume_fees(usdc_address TEXT)
RETURNS TABLE (
  total_volume NUMERIC,
  total_fees NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN LOWER(token_in) = LOWER(usdc_address) THEN 
          (amount_in::NUMERIC / 1000000) -- USDC has 6 decimals
        WHEN LOWER(token_out) = LOWER(usdc_address) THEN 
          (amount_out::NUMERIC / 1000000) -- USDC has 6 decimals
        ELSE 0
      END
    ), 0) as total_volume,
    COALESCE(SUM(
      CASE 
        WHEN LOWER(token_in) = LOWER(usdc_address) THEN 
          (amount_in::NUMERIC / 1000000) * 0.003 -- 0.3% fee
        WHEN LOWER(token_out) = LOWER(usdc_address) THEN 
          (amount_out::NUMERIC / 1000000) * 0.003 -- 0.3% fee
        ELSE 0
      END
    ), 0) as total_fees
  FROM swap_events
  WHERE LOWER(token_in) = LOWER(usdc_address) 
     OR LOWER(token_out) = LOWER(usdc_address);
END;
$$ LANGUAGE plpgsql;

-- Function to get daily volume and fees (all time or specific days)
-- Pass NULL or 0 for days_back to get ALL TIME data
-- Pass a number (e.g., 30) to get last N days
CREATE OR REPLACE FUNCTION get_daily_volume_fees(usdc_address TEXT, days_back INTEGER DEFAULT NULL)
RETURNS TABLE (
  date DATE,
  volume NUMERIC,
  fees NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(timestamp) as date,
    COALESCE(SUM(
      CASE 
        WHEN LOWER(token_in) = LOWER(usdc_address) THEN 
          (amount_in::NUMERIC / 1000000) -- USDC has 6 decimals
        WHEN LOWER(token_out) = LOWER(usdc_address) THEN 
          (amount_out::NUMERIC / 1000000) -- USDC has 6 decimals
        ELSE 0
      END
    ), 0) as volume,
    COALESCE(SUM(
      CASE 
        WHEN LOWER(token_in) = LOWER(usdc_address) THEN 
          (amount_in::NUMERIC / 1000000) * 0.003 -- 0.3% fee
        WHEN LOWER(token_out) = LOWER(usdc_address) THEN 
          (amount_out::NUMERIC / 1000000) * 0.003 -- 0.3% fee
        ELSE 0
      END
    ), 0) as fees
  FROM swap_events
  WHERE (LOWER(token_in) = LOWER(usdc_address) 
     OR LOWER(token_out) = LOWER(usdc_address))
    AND (days_back IS NULL OR days_back = 0 OR timestamp >= NOW() - (days_back || ' days')::INTERVAL)
  GROUP BY DATE(timestamp)
  ORDER BY date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get volume and fees for specific time periods (for future use)
-- Examples: get_volume_fees_period('0x3600...', 7) for 7 days, get_volume_fees_period('0x3600...', 30) for 30 days
CREATE OR REPLACE FUNCTION get_volume_fees_period(usdc_address TEXT, days_back INTEGER)
RETURNS TABLE (
  total_volume NUMERIC,
  total_fees NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN LOWER(token_in) = LOWER(usdc_address) THEN 
          (amount_in::NUMERIC / 1000000) -- USDC has 6 decimals
        WHEN LOWER(token_out) = LOWER(usdc_address) THEN 
          (amount_out::NUMERIC / 1000000) -- USDC has 6 decimals
        ELSE 0
      END
    ), 0) as total_volume,
    COALESCE(SUM(
      CASE 
        WHEN LOWER(token_in) = LOWER(usdc_address) THEN 
          (amount_in::NUMERIC / 1000000) * 0.003 -- 0.3% fee
        WHEN LOWER(token_out) = LOWER(usdc_address) THEN 
          (amount_out::NUMERIC / 1000000) * 0.003 -- 0.3% fee
        ELSE 0
      END
    ), 0) as total_fees
  FROM swap_events
  WHERE (LOWER(token_in) = LOWER(usdc_address) 
     OR LOWER(token_out) = LOWER(usdc_address))
    AND timestamp >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions (if using RLS)
GRANT EXECUTE ON FUNCTION get_total_volume_fees(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_daily_volume_fees(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_volume_fees_period(TEXT, INTEGER) TO anon;

