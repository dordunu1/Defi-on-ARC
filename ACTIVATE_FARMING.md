# Activate LP Farming - Quick Steps

Since you've already run the SQL schema, here are the remaining steps to activate farming:

## ✅ Already Done
- ✅ SQL schema run in Supabase
- ✅ Farming tab added to navigation
- ✅ Farming route configured
- ✅ Frontend components ready

## 📋 Steps to Complete

### 1. Deploy Staking Contracts

```bash
cd contracts
npm run deploy:staking
```

**After deployment, save these addresses:**
- DOA Token Address: `0x...`
- StakingRewards Address: `0x...`

---

### 2. Update Frontend Config

Edit `src/config/dex.ts`:

```typescript
export const DEX_CONFIG = {
  // ... existing config ...
  DOA_TOKEN_ADDRESS: "0x...", // ← Paste DOA token address
  STAKING_REWARDS_ADDRESS: "0x...", // ← Paste StakingRewards address
};
```

---

### 3. Add USDC Pairs to Staking

```bash
cd contracts
npm run add-usdc-pools
```

This automatically adds all USDC pairs with 1.5 DOA/sec reward rate.

---

### 4. Add Indexer Environment Variable

**In Railway (or your indexer hosting):**

Add environment variable:
- **Name:** `STAKING_REWARDS_ADDRESS`
- **Value:** Your StakingRewards address from Step 1

**Restart the indexer** after adding the variable.

---

## ✅ Verification

After completing all steps:

1. **Check Frontend:**
   - Navigate to `/farming` tab
   - Should show farming interface (not "not deployed" message)

2. **Check Database:**
   - Supabase → Table Editor
   - `staking_pools` table should populate after Step 3
   - `staking_positions` will populate as users stake

3. **Check Indexer Logs:**
   - Should see "🔄 Indexing staking data..." every 30 minutes
   - Should see "✅ Staking data indexed successfully"

---

## 🎯 That's It!

Once these 4 steps are complete, farming will be fully operational:
- Users can stake LP tokens
- Rewards accumulate in real-time
- Data tracked in Supabase
- Indexer updates every 30 minutes
