# LP Farming (Liquidity Mining) Explained

## What is LP Farming?

LP Farming (also called Liquidity Mining) is a mechanism where users **stake their LP tokens** to earn additional rewards in the form of a governance or reward token (in your case, DOA tokens).

### The Flow:
1. User provides liquidity to a pool → receives LP tokens
2. User stakes LP tokens in a farming contract → earns DOA tokens over time
3. User can unstake LP tokens at any time → gets LP tokens back
4. User can claim earned DOA rewards → receives DOA tokens (currently disabled for future airdrop)

## How It Works Mechanically

### 1. **Staking LP Tokens**
- User approves the staking contract to spend their LP tokens
- User calls `stake(amount)` → LP tokens are transferred to the staking contract
- Contract tracks how much each user has staked and when they staked

### 2. **Accumulating Rewards**
- Rewards accumulate based on:
  - **Reward Rate**: How many DOA tokens per second are distributed
  - **Total Staked**: Total LP tokens staked in the pool
  - **Your Stake**: Your share of the total staked
  - **Time**: How long you've been staking

### 3. **Reward Calculation Formula**

```
Your Reward = (Your Staked Amount / Total Staked) × Reward Rate × Time Elapsed
```

**Example:**
- Total staked: 10,000 LP tokens
- Your stake: 1,000 LP tokens (10% of total)
- Reward rate: 1.5 DOA tokens per second
- Time: 1 day = 86,400 seconds

Your reward = (1,000 / 10,000) × 1.5 × 86,400 = 12,960 DOA tokens

### 4. **Claiming Rewards**
- User calls `claimRewards()` → receives all accumulated DOC tokens
- Rewards continue accumulating after claiming (as long as you're still staked)

### 5. **Unstaking**
- User calls `unstake(amount)` → LP tokens are returned
- Can unstake partially or fully
- Usually, unstaking doesn't automatically claim rewards (user must call `claimRewards()` separately)

## APY vs APR

### **APR (Annual Percentage Rate)**
- Simple interest rate, doesn't compound
- Formula: `APR = (Reward Rate × Seconds Per Year) / Total Staked × Token Price Ratio`
- Example: If 1,000,000 DOC tokens are distributed per year and total staked is worth $100,000, APR = 1,000,000 / 100,000 = 10x = 1000% APR

### **APY (Annual Percentage Yield)**
- Compound interest rate (if you reinvest rewards)
- Formula: `APY = (1 + APR/n)^n - 1` where n = compounding frequency
- If you claim and restake rewards daily, APY will be higher than APR

### **Real-World Calculation**

For LP farming, APY typically includes:
1. **Farming Rewards APY**: From staking LP tokens
2. **Trading Fee APY**: From providing liquidity (0.3% of swaps go to LPs)
3. **Impermanent Loss**: Can reduce effective APY (but not included in calculation)

**Total APY = Farming APY + Trading Fee APY**

## How APY is Determined in Practice

### Factors:
1. **Reward Token Emission Rate**: How many DOC tokens per second/day/week
2. **Total Value Locked (TVL)**: Total value of LP tokens staked
3. **Token Price**: Price of DOC token vs price of LP token
4. **Trading Volume**: More volume = more fees = higher APY

### Dynamic APY Calculation:

```javascript
// Pseudo-code
const rewardRatePerSecond = 100; // DOC tokens per second
const secondsPerYear = 31536000;
const totalRewardsPerYear = rewardRatePerSecond * secondsPerYear;

// Get total staked LP tokens
const totalStakedLP = await stakingContract.totalStaked(poolAddress);

// Get LP token price (in USD or DOC)
const lpTokenPrice = await getLPTokenPrice(poolAddress);

// Calculate total value staked
const totalValueStaked = totalStakedLP * lpTokenPrice;

// Get DOC token price
const docTokenPrice = await getTokenPrice('DOC');

// Calculate APR
const rewardsValuePerYear = totalRewardsPerYear * docTokenPrice;
const apr = (rewardsValuePerYear / totalValueStaked) * 100;

// If compounding daily
const apy = (Math.pow(1 + (apr / 100) / 365, 365) - 1) * 100;
```

## Common Patterns

### 1. **Fixed Reward Rate**
- Contract emits X tokens per second
- Simple and predictable
- APY decreases as more people stake (more stakers = smaller share per person)

### 2. **Weighted Rewards**
- Different pools get different reward rates
- Example: USDC/SRAC pool gets 2x rewards vs other pools
- Encourages liquidity in specific pools

### 3. **Time-Locked Staking**
- Longer staking periods = higher rewards
- Example: 30-day lock = 1.5x rewards, 90-day lock = 2x rewards

### 4. **Multi-Pool Farming**
- One staking contract supports multiple pools
- Each pool has its own reward rate
- Users can stake in multiple pools simultaneously

## Security Considerations

1. **Reentrancy Protection**: Use `nonReentrant` modifier
2. **Reward Token Supply**: Ensure contract has enough DOC tokens
3. **Emergency Withdraw**: Allow admin to pause or withdraw in emergencies
4. **Access Control**: Only admin can add pools or change reward rates

## Implementation Strategy

For your DEX, we'll implement:

1. **Multi-Pool Staking Contract**: Supports all pools created by your factory
2. **Dynamic Reward Rates**: Admin can set different rates per pool
3. **Real-time APY Calculation**: Frontend calculates APY based on current state
4. **Auto-Compounding Option**: (Optional) Automatically restake rewards

## Example User Journey

1. User adds liquidity to USDC/SRAC pool → Gets 100 LP tokens
2. User stakes 100 LP tokens in farming contract
3. After 1 week, user has earned 50 DOC tokens
4. User claims 50 DOC tokens
5. User continues staking → earns more DOC tokens
6. After 1 month, user unstakes 50 LP tokens (keeps 50 staked)
7. User removes liquidity from pool → gets USDC and SRAC back

## Key Metrics to Display in UI

1. **Total Staked**: Total LP tokens staked in each pool
2. **Your Stake**: User's staked LP tokens
3. **Pending Rewards**: DOC tokens earned but not yet claimed
4. **APY**: Current annual percentage yield
5. **Reward Rate**: DOC tokens per second for the pool
6. **Time Staked**: How long user has been staking
