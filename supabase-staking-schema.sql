-- Supabase Tables for Staking/Farming Indexer
-- Run this SQL in your Supabase SQL Editor

-- Table for staking pools (tracks which pools are enabled for staking)
CREATE TABLE IF NOT EXISTS staking_pools (
  id BIGSERIAL PRIMARY KEY,
  pool_address TEXT UNIQUE NOT NULL,
  lp_token TEXT NOT NULL,
  reward_rate TEXT NOT NULL, -- DOC tokens per second (stored as string for bigint)
  total_staked TEXT NOT NULL DEFAULT '0', -- Total LP tokens staked (stored as string)
  is_active BOOLEAN DEFAULT true,
  last_update_time TIMESTAMPTZ,
  reward_per_token_stored TEXT DEFAULT '0', -- Accumulated rewards per token (stored as string)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for staking_pools
CREATE INDEX IF NOT EXISTS idx_staking_pools_pool_address ON staking_pools(pool_address);
CREATE INDEX IF NOT EXISTS idx_staking_pools_is_active ON staking_pools(is_active);
CREATE INDEX IF NOT EXISTS idx_staking_pools_updated_at ON staking_pools(updated_at);

-- Table for user staking positions (tracks each user's staking in each pool)
CREATE TABLE IF NOT EXISTS staking_positions (
  id BIGSERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  pool_address TEXT NOT NULL,
  staked_amount TEXT NOT NULL DEFAULT '0', -- LP tokens staked by user (stored as string)
  accumulated_rewards TEXT NOT NULL DEFAULT '0', -- Total DOC rewards accumulated (stored as string)
  reward_per_token_paid TEXT DEFAULT '0', -- Reward per token when user last updated (stored as string)
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: one position per user per pool
  UNIQUE(user_address, pool_address)
);

-- Indexes for staking_positions
CREATE INDEX IF NOT EXISTS idx_staking_positions_user_address ON staking_positions(user_address);
CREATE INDEX IF NOT EXISTS idx_staking_positions_pool_address ON staking_positions(pool_address);
CREATE INDEX IF NOT EXISTS idx_staking_positions_user_pool ON staking_positions(user_address, pool_address);
CREATE INDEX IF NOT EXISTS idx_staking_positions_last_updated ON staking_positions(last_updated);

-- Table for staking events (history of stake/unstake/claim events)
CREATE TABLE IF NOT EXISTS staking_events (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL, -- 'stake', 'unstake', 'claim'
  user_address TEXT NOT NULL,
  pool_address TEXT NOT NULL,
  amount TEXT NOT NULL, -- Amount involved (stored as string)
  block_number TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for staking_events
CREATE INDEX IF NOT EXISTS idx_staking_events_tx_hash ON staking_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_staking_events_user_address ON staking_events(user_address);
CREATE INDEX IF NOT EXISTS idx_staking_events_pool_address ON staking_events(pool_address);
CREATE INDEX IF NOT EXISTS idx_staking_events_event_type ON staking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_staking_events_timestamp ON staking_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_staking_events_user_timestamp ON staking_events(user_address, timestamp DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_staking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at for staking_pools
DROP TRIGGER IF EXISTS update_staking_pools_updated_at ON staking_pools;
CREATE TRIGGER update_staking_pools_updated_at 
  BEFORE UPDATE ON staking_pools 
  FOR EACH ROW 
  EXECUTE FUNCTION update_staking_updated_at();

-- Trigger to update last_updated for staking_positions
DROP TRIGGER IF EXISTS update_staking_positions_last_updated ON staking_positions;
CREATE TRIGGER update_staking_positions_last_updated 
  BEFORE UPDATE ON staking_positions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_staking_updated_at();

-- View for aggregated staking stats per pool
CREATE OR REPLACE VIEW staking_pool_stats AS
SELECT 
  sp.pool_address,
  sp.lp_token,
  sp.reward_rate,
  sp.total_staked,
  sp.is_active,
  COUNT(DISTINCT stp.user_address) as total_stakers,
  SUM(CAST(stp.accumulated_rewards AS NUMERIC)) as total_accumulated_rewards,
  sp.updated_at
FROM staking_pools sp
LEFT JOIN staking_positions stp ON sp.pool_address = stp.pool_address
GROUP BY sp.pool_address, sp.lp_token, sp.reward_rate, sp.total_staked, sp.is_active, sp.updated_at;

-- View for user staking summary (all pools for a user)
CREATE OR REPLACE VIEW user_staking_summary AS
SELECT 
  stp.user_address,
  COUNT(DISTINCT stp.pool_address) as pools_staked,
  SUM(CAST(stp.staked_amount AS NUMERIC)) as total_staked_lp,
  SUM(CAST(stp.accumulated_rewards AS NUMERIC)) as total_accumulated_rewards,
  MAX(stp.last_updated) as last_updated
FROM staking_positions stp
WHERE CAST(stp.staked_amount AS NUMERIC) > 0
GROUP BY stp.user_address;
