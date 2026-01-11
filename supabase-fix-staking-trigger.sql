-- Fix the trigger function for staking_positions
-- The trigger was trying to set updated_at but the table only has last_updated

-- Drop the incorrect trigger
DROP TRIGGER IF EXISTS update_staking_positions_last_updated ON staking_positions;

-- Create a new function that sets last_updated instead of updated_at
CREATE OR REPLACE FUNCTION update_staking_positions_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the correct trigger for staking_positions (uses last_updated)
CREATE TRIGGER update_staking_positions_last_updated 
  BEFORE UPDATE ON staking_positions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_staking_positions_last_updated();

-- Keep the existing function for staking_pools (uses updated_at)
-- This function is already correct for staking_pools table
