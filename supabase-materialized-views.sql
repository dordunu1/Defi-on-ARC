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

-- Initial refresh to populate the views
REFRESH MATERIALIZED VIEW volume_fees_total;
REFRESH MATERIALIZED VIEW volume_fees_daily;

