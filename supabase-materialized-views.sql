-- Materialized Views for Volume and Fees Aggregation
-- Run this SQL in your Supabase SQL Editor to create optimized materialized views
-- These views pre-aggregate data to avoid scanning 90k+ rows on every query

-- Materialized view for total volume and fees (all time)
-- This stores pre-calculated totals, so queries just read 1 row instead of scanning all events
CREATE MATERIALIZED VIEW IF NOT EXISTS volume_fees_total AS
SELECT 
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) -- USDC has 6 decimals
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) -- USDC has 6 decimals
      ELSE 0
    END
  ), 0) as total_volume,
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) * 0.003 -- 0.3% fee
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) * 0.003 -- 0.3% fee
      ELSE 0
    END
  ), 0) as total_fees,
  MAX(timestamp) as last_updated
FROM swap_events
WHERE LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') 
   OR LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000');

-- Materialized view for daily volume and fees (last 90 days)
-- This stores pre-calculated daily aggregates, so queries just read 90 rows instead of scanning all events
CREATE MATERIALIZED VIEW IF NOT EXISTS volume_fees_daily AS
SELECT 
  DATE(timestamp) as date,
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) -- USDC has 6 decimals
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) -- USDC has 6 decimals
      ELSE 0
    END
  ), 0) as volume,
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) * 0.003 -- 0.3% fee
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) * 0.003 -- 0.3% fee
      ELSE 0
    END
  ), 0) as fees
FROM swap_events
WHERE (LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') 
   OR LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000'))
  AND timestamp >= NOW() - INTERVAL '90 days'
GROUP BY DATE(timestamp)
ORDER BY date ASC;

-- Create indexes on materialized views for faster queries
CREATE INDEX IF NOT EXISTS idx_volume_fees_daily_date ON volume_fees_daily(date DESC);

-- Function to refresh both materialized views
-- Call this every 10 minutes to keep data up to date
CREATE OR REPLACE FUNCTION refresh_volume_fees_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW volume_fees_total;
  REFRESH MATERIALIZED VIEW volume_fees_daily;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON volume_fees_total TO anon;
GRANT SELECT ON volume_fees_daily TO anon;
GRANT EXECUTE ON FUNCTION refresh_volume_fees_views() TO anon;

-- Materialized view for 24h volume per pool
-- This stores pre-calculated 24h volume for each pool, including ALL swaps (not limited to 1500)
-- Queries read 1 row per pool instead of scanning thousands of events
CREATE MATERIALIZED VIEW IF NOT EXISTS pool_volume_24h AS
SELECT 
  LOWER(pool_address) as pool_address,
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) -- USDC has 6 decimals
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) -- USDC has 6 decimals
      ELSE 0
    END
  ), 0) as volume_24h,
  MAX(timestamp) as last_updated
FROM swap_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
  AND (LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') 
   OR LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000'))
GROUP BY LOWER(pool_address);

-- Create index on pool_volume_24h for fast lookups
CREATE INDEX IF NOT EXISTS idx_pool_volume_24h_pool_address ON pool_volume_24h(pool_address);

-- Function to refresh pool_volume_24h view (call this hourly)
CREATE OR REPLACE FUNCTION refresh_pool_volume_24h()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW pool_volume_24h;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all materialized views (volume_fees + pool_volume_24h)
-- Call this every 10 minutes for volume_fees, and hourly for pool_volume_24h
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW volume_fees_total;
  REFRESH MATERIALIZED VIEW volume_fees_daily;
  REFRESH MATERIALIZED VIEW pool_volume_24h;
END;
$$ LANGUAGE plpgsql;

-- Materialized view for total fees per pool (all-time)
-- This stores pre-calculated total fees for each pool (0.3% of volume)
-- Queries read 1 row per pool instead of scanning all swap events
CREATE MATERIALIZED VIEW IF NOT EXISTS pool_fees_total AS
SELECT 
  LOWER(pool_address) as pool_address,
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) * 0.003 -- 0.3% fee on USDC input
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) * 0.003 -- 0.3% fee on USDC output
      ELSE 0
    END
  ), 0) as total_fees,
  COALESCE(SUM(
    CASE 
      WHEN LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_in::NUMERIC / 1000000) -- Total volume in USDC
      WHEN LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000') THEN 
        (amount_out::NUMERIC / 1000000) -- Total volume in USDC
      ELSE 0
    END
  ), 0) as total_volume,
  MAX(timestamp) as last_updated
FROM swap_events
WHERE (LOWER(token_in) = LOWER('0x3600000000000000000000000000000000000000') 
   OR LOWER(token_out) = LOWER('0x3600000000000000000000000000000000000000'))
GROUP BY LOWER(pool_address);

-- Create index on pool_fees_total for fast lookups
CREATE INDEX IF NOT EXISTS idx_pool_fees_total_pool_address ON pool_fees_total(pool_address);

-- Function to refresh pool_fees_total view (call this every 24 hours)
CREATE OR REPLACE FUNCTION refresh_pool_fees_total()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW pool_fees_total;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all materialized views (volume_fees + pool_volume_24h + pool_fees_total)
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW volume_fees_total;
  REFRESH MATERIALIZED VIEW volume_fees_daily;
  REFRESH MATERIALIZED VIEW pool_volume_24h;
  REFRESH MATERIALIZED VIEW pool_fees_total;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON pool_volume_24h TO anon;
GRANT SELECT ON pool_fees_total TO anon;
GRANT EXECUTE ON FUNCTION refresh_pool_volume_24h() TO anon;
GRANT EXECUTE ON FUNCTION refresh_pool_fees_total() TO anon;
GRANT EXECUTE ON FUNCTION refresh_all_materialized_views() TO anon;

-- Initial refresh to populate the views
REFRESH MATERIALIZED VIEW volume_fees_total;
REFRESH MATERIALIZED VIEW volume_fees_daily;
REFRESH MATERIALIZED VIEW pool_volume_24h;
REFRESH MATERIALIZED VIEW pool_fees_total;


