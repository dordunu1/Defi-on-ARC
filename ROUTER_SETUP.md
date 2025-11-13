# Router Setup Guide - Multi-Hop Swaps

The Router contract enables multi-hop swaps (e.g., SRAC → USDC → RACS) without needing a direct pool between the two tokens.

## ✅ What You Get

- **Multi-hop swaps**: Swap tokens even if there's no direct pool
- **Automatic path finding**: Router finds the best path (direct or via USDC)
- **Works with existing pools**: No need to redeploy pools or factory
- **Backward compatible**: Direct swaps still work as before

## 🚀 Deployment Steps

### 1. Deploy Router Contract

```bash
cd contracts
npm run deploy:arc:router
```

This will:
- Deploy the Router contract
- Link it to your existing Factory
- Save the Router address to `DEPLOYMENT_ADDRESSES.txt`

### 2. Update Frontend Config

After deployment, update `src/config/dex.ts`:

```typescript
export const DEX_CONFIG = {
  FACTORY_ADDRESS: "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C",
  ROUTER_ADDRESS: "0x...", // ← Add the Router address here
  // ... rest of config
};
```

### 3. That's It!

The Router will automatically work with all your existing pools. No migration needed!

## 📝 How It Works

### Direct Swap (Existing Behavior)
```
User → Pool (SRAC/USDC) → User
```

### Multi-Hop Swap (New!)
```
User → Router → Pool1 (SRAC/USDC) → Router → Pool2 (USDC/RACS) → User
```

The Router:
1. Finds the swap path (direct or via USDC)
2. Executes multiple swaps in sequence
3. Handles intermediate token transfers
4. Returns final tokens to user

## 🔧 Usage in Frontend

The `swap()` function in `useDEX.ts` automatically:
- Tries direct pool first (faster, cheaper)
- Falls back to Router if no direct pool exists
- Handles approvals automatically

### Example: Swap SRAC for RACS

```typescript
const { swap, approveRouter } = useDEX();

// If Router is needed, approve it first
await approveRouter('SRAC');

// Swap - Router will be used automatically if no direct pool
await swap('SRAC', 'RACS', '100', 0.5); // 0.5% slippage
```

## 🎯 Path Finding

The Router tries paths in this order:
1. **Direct pool**: SRAC → RACS (if exists)
2. **Via USDC**: SRAC → USDC → RACS (if both pools exist)

## ⚠️ Important Notes

1. **Router Approval**: Users need to approve the Router (not the pool) for multi-hop swaps
2. **Gas Costs**: Multi-hop swaps cost more gas (2 transactions instead of 1)
3. **Slippage**: Applies to the final output amount (after all hops)
4. **Existing Pools**: All existing pools and liquidity remain unchanged

## 🔍 Testing

After deployment, test multi-hop swaps:

1. Ensure you have pools:
   - SRAC/USDC pool (with liquidity)
   - USDC/RACS pool (with liquidity)

2. Try swapping SRAC → RACS
   - Router will automatically use: SRAC → USDC → RACS

3. Check transaction on explorer
   - You'll see Router contract called
   - Router calls both pools internally

## 📊 Contract Addresses

After deployment, check `contracts/DEPLOYMENT_ADDRESSES.txt`:

```json
{
  "router": {
    "address": "0x...",
    "factory": "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C",
    "deployedAt": "2024-..."
  }
}
```

## 🐛 Troubleshooting

**Error: "Router not deployed"**
- Make sure `ROUTER_ADDRESS` is set in `src/config/dex.ts`

**Error: "No path found"**
- Ensure both pools exist (e.g., SRAC/USDC and USDC/RACS)
- Check that pools have liquidity

**Error: "Insufficient allowance"**
- User needs to approve Router (not pool) for multi-hop swaps
- Use `approveRouter()` function

## 🎉 Benefits

- ✅ No pool redeployment needed
- ✅ All existing liquidity preserved
- ✅ Backward compatible with direct swaps
- ✅ Automatic path optimization
- ✅ Better user experience (can swap any token pair)

