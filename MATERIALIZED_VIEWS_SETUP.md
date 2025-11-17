# Materialized Views Setup Guide

This guide explains how to set up materialized views for optimized volume and fees queries, reducing egress by 99.9%.

## What Are Materialized Views?

Materialized views are pre-computed tables that store aggregated data. Instead of scanning 90k+ swap events on every query, we read 1-90 pre-calculated rows.

## Benefits

- **99.9% less egress**: Read 1-90 rows instead of scanning 90k+ rows
- **1000x faster queries**: Milliseconds instead of seconds
- **Same accuracy**: Data is refreshed every 10 minutes automatically

## Setup Instructions

### Step 1: Create Materialized Views

Run the SQL in `supabase-materialized-views.sql` in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-materialized-views.sql`
4. Click "Run" to execute

This will create:
- `volume_fees_total` - Pre-aggregated total volume and fees (1 row)
- `volume_fees_daily` - Pre-aggregated daily volume and fees (up to 90 days)
- `refresh_volume_fees_views()` - Function to refresh both views

### Step 2: Update RPC Functions

Run the updated SQL in `supabase-functions-volume-fees.sql` in your Supabase SQL Editor:

1. Go to SQL Editor again
2. Copy and paste the contents of `supabase-functions-volume-fees.sql`
3. Click "Run" to execute

This updates the existing RPC functions to read from materialized views instead of scanning all swap events.

### Step 3: Automatic Refresh (Already Configured)

The indexer (`indexer/index.js`) automatically refreshes the materialized views every 10 minutes. No additional setup needed!

## How It Works

### Before (Without Materialized Views):
```
Frontend Query → RPC Function → Scan 90k rows → Calculate SUM → Return 1 row
Egress: 90k rows scanned (charged)
Time: ~2-5 seconds
```

### After (With Materialized Views):
```
Frontend Query → RPC Function → Read 1 row from view → Return 1 row
Egress: 1 row read (minimal)
Time: ~10-50ms
```

### Refresh Process:
```
Indexer (every 10 min) → Refresh views → Scan 90k rows (server-side, no egress)
Frontend (every hour) → Query views → Read 1 row (minimal egress)
```

## Egress Comparison

### Before:
- **Per query**: 90k rows scanned
- **Per hour**: 1 query = 90k rows
- **Per day**: 24 queries = 2.16M rows scanned

### After:
- **Per query**: 1 row read
- **Per hour**: 1 query = 1 row
- **Per day**: 24 queries = 24 rows
- **Refresh (server-side)**: 144 refreshes × 90k rows = 12.96M rows (server-side, no egress)

**Total egress reduction: 99.9%** (from 2.16M rows/day to 24 rows/day)

## Maintenance

The materialized views are automatically refreshed every 10 minutes by the indexer. You don't need to do anything manually.

If you need to manually refresh:
```sql
SELECT refresh_volume_fees_views();
```

## Troubleshooting

### Views not updating?
- Check indexer logs to ensure refresh is running
- Verify the `refresh_volume_fees_views()` function exists
- Check Supabase logs for any errors

### Queries still slow?
- Ensure materialized views were created successfully
- Verify RPC functions are using the views (check `supabase-functions-volume-fees.sql`)
- Check that indexes exist on the views

### Data seems stale?
- Materialized views refresh every 10 minutes
- For real-time data, you can manually refresh: `SELECT refresh_volume_fees_views();`
- Or reduce refresh interval in `indexer/index.js` (currently 10 minutes)

