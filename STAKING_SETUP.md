# LP Farming/Staking Setup Guide

This guide explains how to set up and use the LP farming (staking) system for your DEX.

## Overview

The staking system allows users to:
1. Stake their LP tokens to earn DOA (reward token) rewards
2. Unstake LP tokens at any time
3. Claim accumulated DOA rewards (currently disabled for future airdrop)
4. View APY and staking statistics

## Architecture

### Contracts

1. **StakingRewards.sol** - Main staking contract that:
   - Supports multiple LP pools simultaneously
   - Distributes DOA tokens as rewards
   - Tracks staked amounts and pending rewards
   - Allows admin to add/update pools and reward rates

2. **DOA Token** - Reward token (ERC20) that users earn for staking LP tokens

### Frontend

1. **useStaking.ts** - React hook for interacting with staking contract
2. **Farming.tsx** - UI component for staking/unstaking and viewing rewards
3. **Config updates** - Added DOA token and staking contract addresses

## Deployment Steps

### 1. Deploy DOA Token and Staking Contract

```bash
cd contracts
npm run deploy:staking
# Or manually:
npx hardhat run scripts/deployStaking.ts --network arc-testnet
```

This will:
- Deploy DOA token (10M supply)
- Deploy StakingRewards contract
- Transfer 1M DOA tokens to StakingRewards for rewards

### 2. Update Configuration

After deployment, update `src/config/dex.ts`:

```typescript
export const DEX_CONFIG = {
  // ... existing config ...
  DOA_TOKEN_ADDRESS: "0x...", // From deployment
  STAKING_REWARDS_ADDRESS: "0x...", // From deployment
};
```

### 3. Add Pools to Staking Contract

For each pool you want to enable farming, call `addPool()`:

```typescript
// Example: Add USDC/SRAC pool with 1.5 DOA tokens per second reward rate
await stakingRewards.addPool(
  poolAddress,        // Pool contract address
  poolAddress,        // LP token address (same as pool for SimplePoolWithLP)
  ethers.parseEther("1.5") // 1.5 DOA tokens per second
);
```

**Reward Rate Calculation:**
- 1.5 DOA/sec = 129,600 DOA/day = 47,304,000 DOA/year
- Adjust based on your tokenomics and desired APY

### 4. Fund Staking Contract

Ensure the StakingRewards contract has enough DOA tokens:

```typescript
// Transfer more DOA tokens if needed
await doaToken.transfer(stakingRewardsAddress, ethers.parseEther("1000000"));
```

## Adding Farming to Your App

### 1. Add Route to Farming Component

In your router (e.g., `App.tsx`):

```typescript
import Farming from './components/Farming';

// Add route:
<Route path="/farming" element={<Farming />} />
```

### 2. Add Navigation Link

Add a link to the farming page in your navigation:

```typescript
<Link to="/farming">Farming</Link>
```

## How It Works

### For Users

1. **Provide Liquidity**: User adds liquidity to a pool → receives LP tokens
2. **Stake LP Tokens**: User stakes LP tokens in the farming contract
3. **Earn Rewards**: DOA tokens accumulate based on:
   - Reward rate (DOA per second)
   - User's share of total staked
   - Time staked
4. **Claim Rewards**: User claims accumulated DOA tokens (currently disabled for future airdrop)
5. **Unstake**: User can unstake LP tokens at any time

### Reward Calculation

```
Your Reward = (Your Staked Amount / Total Staked) × Reward Rate × Time Elapsed
```

**Example:**
- Total staked: 10,000 LP tokens
- Your stake: 1,000 LP tokens (10%)
- Reward rate: 1.5 DOA/sec
- Time: 1 day = 86,400 seconds
- Your reward: (1,000 / 10,000) × 1.5 × 86,400 = 12,960 DOA

### APY Calculation

The frontend calculates APY as:

```
APR = (Annual Rewards / Total Staked) × 100
APY = (1 + APR/365)^365 - 1  (with daily compounding)
```

**Note:** Current implementation assumes 1 DOC = 1 LP token value. For production, integrate price oracles to get accurate APY.

## Admin Functions

### Add New Pool

```typescript
await stakingRewards.addPool(poolAddress, lpTokenAddress, rewardRate);
```

### Update Reward Rate

```typescript
await stakingRewards.updateRewardRate(poolAddress, newRewardRate);
```

### Deactivate Pool

```typescript
await stakingRewards.deactivatePool(poolAddress);
```

### Emergency Withdraw

```typescript
await stakingRewards.emergencyWithdrawRewards(amount);
```

## UI Features

The Farming component includes:

1. **All Pools Tab**: View all staking pools with:
   - Your staked amount
   - Pending rewards
   - Total staked
   - Reward rate
   - APY (if calculable)

2. **Stake Tab**: Stake LP tokens for a specific pool
   - Token pair selector
   - Amount input with MAX button
   - Auto-approval if needed
   - Pool info display

3. **Unstake Tab**: Unstake LP tokens
   - Token pair selector
   - Amount input with MAX button
   - Claim rewards button

## Best Practices

1. **Reward Rates**: Start with conservative rates and adjust based on:
   - Total DOC supply allocated for rewards
   - Desired APY targets
   - Pool importance (prioritize major pairs)

2. **Monitoring**: Track:
   - Total DOC distributed
   - Staking participation rates
   - APY trends
   - Contract balance

3. **Security**:
   - Only owner can add/update pools
   - Reentrancy protection on all functions
   - Emergency withdraw function for safety

4. **User Experience**:
   - Clear APY display
   - Real-time reward updates
   - Easy claim/unstake flows
   - Clear error messages

## Troubleshooting

### "Staking contract not deployed"
- Deploy using `deployStaking.ts` script
- Update `DEX_CONFIG.STAKING_REWARDS_ADDRESS`

### "Pool not active"
- Pool needs to be added via `addPool()`
- Check if pool was deactivated

### "Insufficient DOA balance"
- Transfer more DOA tokens to StakingRewards contract
- Check contract balance: `await doaToken.balanceOf(stakingRewardsAddress)`

### APY shows as undefined
- Ensure pool has stakers (totalStaked > 0)
- Check reward rate is set correctly
- Verify pool is active

## Next Steps

1. Deploy contracts
2. Add pools to staking
3. Set reward rates
4. Test with small amounts
5. Monitor and adjust rates as needed
6. Add price oracle integration for accurate APY

## Support

For issues or questions:
- Check contract events for transaction details
- Review `LP_FARMING_EXPLAINED.md` for mechanics
- Test on testnet before mainnet deployment
