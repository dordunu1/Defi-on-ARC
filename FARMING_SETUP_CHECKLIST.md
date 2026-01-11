# LP Farming Setup Checklist

This checklist covers all the manual steps you need to complete to set up LP farming.

## ✅ Completed Automatically

- ✅ Farming tab added to Navigation
- ✅ Farming route added to App.tsx
- ✅ Farming documentation added to Docs.tsx
- ✅ Frontend components created
- ✅ Hooks created
- ✅ Contract code ready

## 📋 Manual Steps Required

### Step 1: Deploy Staking Contracts

```bash
cd contracts
npm run deploy:staking
```

**What to save:**
- DOA Token Address: `0x...`
- StakingRewards Address: `0x...`

**Output location:** `contracts/DEPLOYMENT_ADDRESSES.txt`

---

### Step 2: Run Supabase Staking Schema ⚠️ MANUAL

**This is the most important step - you must do this manually:**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file: `supabase-staking-schema.sql`
4. Copy **ALL** the SQL content
5. Paste into Supabase SQL Editor
6. Click **Run** or press `Ctrl+Enter`

**What this creates:**
- `staking_pools` table
- `staking_positions` table  
- `staking_events` table
- Views for aggregated stats

**Verify it worked:**
- Go to **Table Editor** in Supabase
- You should see the new tables listed

---

### Step 3: Update Frontend Config

Edit `src/config/dex.ts`:

```typescript
export const DEX_CONFIG = {
  // ... existing config ...
  DOA_TOKEN_ADDRESS: "0x...", // ← Paste from Step 1
  STAKING_REWARDS_ADDRESS: "0x...", // ← Paste from Step 1
};
```

**Save the file** after updating.

---

### Step 4: Add USDC Pairs to Staking

```bash
cd contracts
npm run add-usdc-pools
```

This automatically:
- Finds all USDC pairs from factory
- Adds each to staking with 1.5 DOA/sec reward rate
- Skips pools already added

**Verify:**
- Check console output for "Successfully added" messages
- Should see all your USDC pairs listed

---

### Step 5: Configure Indexer Environment Variable

**In Railway (or your indexer hosting):**

1. Go to your indexer service
2. Open **Variables** tab
3. Add new variable:
   - **Name:** `STAKING_REWARDS_ADDRESS`
   - **Value:** `0x...` (your StakingRewards address from Step 1)
4. **Save/Redeploy** the indexer

**What this does:**
- Enables staking data indexing
- Updates Supabase every 30 minutes
- Tracks all staking positions

---

### Step 6: Verify Everything Works

1. **Check Frontend:**
   - Navigate to `/farming` route
   - Should see farming interface (may show "not deployed" if addresses not set)

2. **Check Database:**
   - Go to Supabase Table Editor
   - Check `staking_pools` table (should be empty until pools added)
   - Check `staking_positions` table (will populate as users stake)

3. **Check Indexer:**
   - Look for "🔄 Indexing staking data..." in logs
   - Should see "✅ Staking data indexed successfully"

---

## 🎯 Quick Reference

### Contract Addresses Needed

After deployment, you'll need:
- **DOA_TOKEN_ADDRESS** → Update in `src/config/dex.ts`
- **STAKING_REWARDS_ADDRESS** → Update in `src/config/dex.ts` AND Railway env vars

### Files to Update

1. ✅ `src/config/dex.ts` - Add DOA_TOKEN_ADDRESS and STAKING_REWARDS_ADDRESS
2. ✅ Supabase - Run `supabase-staking-schema.sql` manually
3. ✅ Railway - Add STAKING_REWARDS_ADDRESS environment variable

### Commands to Run

```bash
# 1. Deploy contracts
cd contracts
npm run deploy:staking

# 2. Add USDC pairs
npm run add-usdc-pools

# 3. (Optional) Check deployment addresses
cat DEPLOYMENT_ADDRESSES.txt
```

---

## 🐛 Troubleshooting

### "Staking Not Available" in UI
- ✅ Check `DOA_TOKEN_ADDRESS` and `STAKING_REWARDS_ADDRESS` are set in `src/config/dex.ts`
- ✅ Verify addresses are correct (not `undefined`)

### Database Tables Missing
- ✅ Run `supabase-staking-schema.sql` in Supabase SQL Editor
- ✅ Check Table Editor to verify tables exist

### Indexer Not Updating Staking Data
- ✅ Verify `STAKING_REWARDS_ADDRESS` is set in Railway environment variables
- ✅ Check indexer logs for errors
- ✅ Restart indexer service if needed

### Pools Not Showing in Farming
- ✅ Run `npm run add-usdc-pools` to add pools to staking
- ✅ Verify pools exist in factory first
- ✅ Check console output for errors

---

## 📝 Summary

**You need to manually:**
1. ✅ Run Supabase SQL schema (`supabase-staking-schema.sql`)
2. ✅ Update `src/config/dex.ts` with contract addresses
3. ✅ Add `STAKING_REWARDS_ADDRESS` to Railway environment variables

**Everything else is automated:**
- ✅ Navigation tab added
- ✅ Route configured
- ✅ Documentation included
- ✅ Scripts ready to run

---

## 🚀 After Setup

Once everything is configured:
- Users can navigate to `/farming` tab
- Users can stake LP tokens
- Rewards accumulate (but can't be claimed yet)
- Indexer tracks everything in Supabase
- You can query Supabase for staking stats

**To view staking data:**
- Query `staking_positions` table for user positions
- Query `staking_pools` table for pool stats
- Use views for aggregated data
