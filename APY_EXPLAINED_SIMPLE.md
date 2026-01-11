# APY Explained (ELI5 - Like You're 5 Years Old)

## What is APY?

**APY (Annual Percentage Yield)** is like the "interest rate" you earn from staking your LP tokens. It tells you how much DOA tokens you'd earn in a year if you staked your LP tokens.

## Why Does It Say "N/A"?

**APY shows "N/A" when:**
- ✅ **No one has staked yet** - The pool exists, but nobody has put LP tokens in it
- ✅ **You haven't staked** - You're looking at the pool, but you haven't staked your LP tokens yet
- ✅ **Total staked is zero** - The pool needs at least some LP tokens staked to calculate APY

**This is completely normal!** Once someone (including you) stakes LP tokens, the APY will appear.

## How APY Works (Simple Version)

Think of it like a **pie**:

1. **The Pie** = Total LP tokens staked in the pool (e.g., 10,000 LP tokens)
2. **Your Slice** = Your staked LP tokens (e.g., 1,000 LP tokens = 10% of the pie)
3. **The Reward** = DOA tokens being distributed (1.5 DOA per second)
4. **Your Share** = You get 10% of all rewards because you have 10% of the pie

### Example:

- **Pool has:** 10,000 LP tokens staked total
- **You stake:** 1,000 LP tokens (10% of the pool)
- **Reward rate:** 1.5 DOA per second
- **Your reward per second:** 0.15 DOA (10% of 1.5)
- **Your reward per day:** 12,960 DOA (0.15 × 86,400 seconds)
- **Your reward per year:** 4,730,400 DOA

**APY Calculation:**
- If 1 DOA = 1 LP token in value
- Annual rewards: 4,730,400 DOA
- Your stake: 1,000 LP tokens
- **APY = (4,730,400 / 1,000) × 100 = 473,040%** (this is simplified - real APY accounts for compounding)

## Why APY Changes

APY is **dynamic** - it changes based on:

1. **More people staking** = Lower APY (more people sharing the same rewards)
2. **Fewer people staking** = Higher APY (fewer people sharing the same rewards)
3. **Reward rate changes** = APY changes (if admin changes the emission rate)

## Real-World Example

Imagine a **pizza party**:
- You bring 1 pizza out of 10 total pizzas (10% share)
- The host gives out 100 slices of cake per hour
- You get 10 slices per hour (10% of 100)
- **APY** tells you: "If this keeps going for a year, you'd get X slices"

But if more people bring pizzas:
- Now there are 20 pizzas total
- You still have 1 pizza, but now it's only 5% of the total
- You get 5 slices per hour instead of 10
- **APY goes down** because more people are sharing

## Summary

- **N/A is normal** when no one has staked yet
- **APY appears** once someone stakes LP tokens
- **APY = Your annual return** from staking
- **APY changes** as more/fewer people stake
- **Higher APY** = Better returns (but usually means fewer people are staking)
