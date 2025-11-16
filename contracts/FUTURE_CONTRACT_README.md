# Future Contract with Protocol Fees

## Overview

This directory contains the **future version** of the DEX contracts that implement a **SushiSwap-like fee model** with protocol revenue generation.

## Files

1. **`FuturePoolWithProtocolFee.sol`** - Pool contract with protocol fees
2. **`FuturePoolFactory.sol`** - Factory contract that deploys pools with protocol fees

## Fee Structure

### Current Version (SimplePoolWithLP.sol)
```
Total Swap Fee: 0.3%
├── LP Providers: 0.3% (100%)
└── Protocol: 0% (0%)
```

### Future Version (FuturePoolWithProtocolFee.sol)
```
Total Swap Fee: 0.3%
├── LP Providers: 0.25% (83.3%)
└── Protocol: 0.05% (16.7%)
```

## Key Features

### 1. Protocol Fee Collection
- **0.05%** of every swap goes to `protocolFeeRecipient`
- Fees are collected in the input token (the token being swapped in)
- Fees are sent immediately on each swap

### 2. LP Fee Distribution
- **0.25%** of every swap stays in the pool
- Increases pool reserves, benefiting all LP providers
- LP providers receive fees when they remove liquidity

### 3. Configurable Protocol Fee Recipient
- Set during pool deployment via factory
- Can be updated by pool owner (for individual pools)
- Factory owner can update recipient for new pools

## Contract Differences

### FuturePoolWithProtocolFee.sol vs SimplePoolWithLP.sol

| Feature | Current | Future |
|---------|---------|--------|
| Total Fee | 0.3% | 0.3% |
| LP Fee | 0.3% | 0.25% |
| Protocol Fee | 0% | 0.05% |
| Protocol Recipient | N/A | Configurable |
| Fee Collection | In reserves | Immediate transfer |

### Swap Function Changes

**Current:**
```solidity
function swapAToB(uint256 amountAIn, ...) {
    // Full amount goes into pool
    tokenA.safeTransferFrom(msg.sender, address(this), amountAIn);
    // Output calculated with 0.3% fee
    amountBOut = _getAmountOut(amountAIn, reserveA, reserveB);
    tokenB.safeTransfer(to, amountBOut);
}
```

**Future:**
```solidity
function swapAToB(uint256 amountAIn, ...) {
    // Calculate protocol fee
    uint256 protocolFee = (amountAIn * PROTOCOL_FEE_BPS) / 10000;
    uint256 amountInAfterProtocolFee = amountAIn - protocolFee;
    
    // Output calculated with 0.25% LP fee
    amountBOut = _getAmountOut(amountInAfterProtocolFee, reserveA, reserveB);
    
    // Transfer full input
    tokenA.safeTransferFrom(msg.sender, address(this), amountAIn);
    
    // Send protocol fee to recipient
    tokenA.safeTransfer(protocolFeeRecipient, protocolFee);
    
    // Transfer output to user
    tokenB.safeTransfer(to, amountBOut);
}
```

## Deployment

### Factory Deployment

```solidity
// Deploy factory with protocol fee recipient
FuturePoolFactory factory = new FuturePoolFactory(
    0xYourTreasuryAddress  // Protocol fee recipient
);
```

### Pool Creation

```solidity
// Create pool (protocol fee recipient set automatically)
address pool = factory.createPool(tokenA, tokenB);
```

## Revenue Calculation

### Example: $1,000,000 Daily Volume

**Current Model:**
- Protocol Revenue: **$0**
- LP Provider Fees: **$3,000/day**

**Future Model:**
- Protocol Revenue: **$500/day** (0.05% × $1M)
- LP Provider Fees: **$2,500/day** (0.25% × $1M)
- **Annual Protocol Revenue: ~$182,500**

### Scaling Example

| Daily Volume | Daily Protocol Revenue | Annual Protocol Revenue |
|--------------|------------------------|------------------------|
| $100,000 | $50 | $18,250 |
| $1,000,000 | $500 | $182,500 |
| $10,000,000 | $5,000 | $1,825,000 |
| $100,000,000 | $50,000 | $18,250,000 |

## Migration Considerations

### When to Migrate

1. **Sufficient Volume**: When daily volume justifies protocol fees
2. **Treasury Setup**: When you have a secure treasury wallet
3. **Community Approval**: If you have governance, get community approval
4. **LP Provider Communication**: Inform LP providers about fee split change

### Migration Strategy

#### Option 1: New Pools Only (Recommended)
- Deploy new factory with protocol fees
- Keep existing pools unchanged (100% to LPs)
- New pools use protocol fee model
- **Pros**: No disruption, gradual transition
- **Cons**: Two fee models coexist

#### Option 2: Upgrade Existing Pools
- Deploy upgradeable proxy contracts
- Upgrade pools to new fee model
- **Pros**: Single fee model
- **Cons**: Complex, requires proxy pattern

#### Option 3: Fork & Migrate
- Create new DEX with protocol fees
- Migrate liquidity from old pools
- **Pros**: Clean slate
- **Cons**: Liquidity migration challenges

## Security Considerations

### Protocol Fee Recipient

1. **Multi-sig Wallet**: Use a multi-sig for treasury
2. **Timelock**: Consider timelock for recipient changes
3. **Monitoring**: Set up alerts for fee collection
4. **Transparency**: Publish treasury address publicly

### Fee Calculation

- Fees are calculated using integer math (no rounding issues)
- Protocol fee is deducted before LP fee calculation
- Both fees are guaranteed to be collected correctly

## Testing Checklist

Before deploying to mainnet:

- [ ] Test protocol fee collection on testnet
- [ ] Verify fee recipient receives correct amounts
- [ ] Test edge cases (very small swaps, very large swaps)
- [ ] Verify LP providers still receive fees correctly
- [ ] Test protocol fee recipient update function
- [ ] Verify factory owner controls
- [ ] Audit by security firm (recommended)

## Events

### Protocol Fee Collection
```solidity
event ProtocolFeeCollected(
    address indexed token,
    uint256 amount,
    address indexed recipient
);
```

### Protocol Fee Recipient Update
```solidity
event ProtocolFeeRecipientUpdated(
    address indexed oldRecipient,
    address indexed newRecipient
);
```

## Example Usage

### Setting Up Protocol Fee Recipient

```solidity
// Deploy factory
FuturePoolFactory factory = new FuturePoolFactory(treasuryAddress);

// Create pool
address pool = factory.createPool(usdcAddress, tokenAddress);

// Get pool instance
FuturePoolWithProtocolFee poolContract = FuturePoolWithProtocolFee(pool);

// Check protocol fee recipient
address recipient = poolContract.getProtocolFeeRecipient();
// Returns: treasuryAddress

// Update recipient (only owner)
poolContract.setProtocolFeeRecipient(newTreasuryAddress);
```

### Monitoring Protocol Fees

```solidity
// Listen for ProtocolFeeCollected events
event ProtocolFeeCollected(address indexed token, uint256 amount, address indexed recipient);

// Calculate total fees collected
// Sum all ProtocolFeeCollected events for a time period
```

## Comparison with Other DEXs

| DEX | Total Fee | LP Fee | Protocol Fee |
|-----|-----------|--------|--------------|
| Uniswap V2 | 0.3% | 0.3% | 0% |
| Uniswap V3 | 0.3% | 0.25-0.3% | 0-0.05%* |
| SushiSwap | 0.3% | 0.25% | 0.05% |
| **Your Future DEX** | **0.3%** | **0.25%** | **0.05%** |

*Uniswap V3 protocol fee is optional and controlled by governance

## Questions?

- See `FEE_MECHANICS_EXPLAINED.md` for detailed fee mechanics
- Review contract code comments for implementation details
- Test on testnet before mainnet deployment

---

**Note**: This is a future implementation. The current production contracts (`SimplePoolWithLP.sol` and `PoolFactory.sol`) remain unchanged and continue to operate with 100% fees to LP providers.

