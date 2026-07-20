# DEX Indexer Setup Guide

## Overview

The indexer listens to blockchain events (swap events from pools) and stores volume/fees data in Supabase. The frontend then fetches this accurate data from Supabase.

## 1. Create Supabase Tables

Run the SQL in `supabase-schema.sql` in your Supabase SQL Editor:

```bash
# The SQL file creates:
# - swap_events table (individual swap events)
# - daily_metrics table (aggregated daily volume/fees per pool)
# - Views for 30-day metrics
# - Indexes for performance
```

## 2. Environment Variables

### For Frontend (.env):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### For Indexer (indexer.ts uses process.env):
Create a `.env` file in the root (or use a `.env.local` for Node.js):
```env
# WebSocket URL (choose one from the options)
WSS_URL=wss://rpc.blockdaemon.testnet.arc.io
# Or alternatives:
# WSS_URL=wss://rpc.drpc.testnet.arc.network
# WSS_URL=wss://rpc.quicknode.testnet.arc.network

# Supabase for Indexer
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 3. Install Dependencies

The indexer requires:
- `@supabase/supabase-js` (already installed)
- `tsx` (already installed)
- `@types/node` (install with: `npm install --save-dev @types/node`)

## 4. Run the Indexer

```bash
# Using tsx (recommended)
npx tsx indexer.ts

# Or if you want to run it continuously in background
npx tsx indexer.ts > indexer.log 2>&1 &
```

The indexer will:
- Poll every 30 seconds
- Listen for new PoolCreated events
- Process Swap events from all pools
- Calculate volume and fees in USD
- Store data in Supabase

## 5. Frontend Integration

The frontend automatically fetches volume and fees from Supabase when:
- `VITE_SUPABASE_URL` is set
- `VITE_SUPABASE_ANON_KEY` is set

The Pools component will display:
- **Total TVL** (calculated on-chain)
- **30d Volume** (from Supabase)
- **30d Fees** (from Supabase)

## Architecture

```
Blockchain (Arc Testnet)
    ↓
Indexer (listens to events via WebSocket)
    ↓
Supabase (stores swap events & daily metrics)
    ↓
Frontend (fetches metrics via REST API)
```

## Notes

- The indexer uses WebSocket for real-time event listening
- Volume/fees are calculated using USDC pairs for pricing
- Daily metrics are aggregated automatically
- The factory view (`factory_metrics_30d`) provides total 30-day metrics across all pools

