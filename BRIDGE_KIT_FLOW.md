# Bridge Kit Flow - How Cross-Chain Bridging Works

This document explains the key process of how Circle's Bridge Kit handles cross-chain token transfers between Ethereum Sepolia and Arc Testnet.

## Overview

Bridge Kit is a complete solution that handles the entire bridging process automatically:
1. **Token Approval** (if needed)
2. **Burn/Transfer** on source chain
3. **Automatic Chain Switching**
4. **Mint/Receive** on destination chain

The `bridge()` method completes only after ALL steps are done or the user cancels.

---

## Core Bridge Process Flow

### Step 1: Initialization & Validation

```typescript
// 1. Validate user is connected
if (!isConnected || !address) {
  throw new Error('Please connect your wallet first');
}

// 2. Validate amount
if (!amount || parseFloat(amount) <= 0) {
  throw new Error('Please enter a valid amount');
}
```

### Step 2: Get Wallet Provider

Bridge Kit needs access to the wallet provider to sign transactions. We try multiple methods for compatibility:

```typescript
// Method 1: Get from active connector (most reliable for RainbowKit)
const account = getAccount(wagmiConfig);
const connector = account.connector;
if (connector?.getProvider) {
  provider = await connector.getProvider();
}

// Method 2: Get from walletClient transport (wagmi v2)
if (!provider && walletClient?.transport) {
  provider = walletClient.transport.value?.provider;
}

// Method 3: Fallback to window.ethereum (MetaMask)
if (!provider && window.ethereum) {
  provider = window.ethereum;
}
```

### Step 3: Create Bridge Kit Adapter

```typescript
// Create adapter from wallet provider
// This adapter allows Bridge Kit to interact with the wallet
const adapter = await createAdapterFromProvider({
  provider: provider,
});
```

### Step 4: Initialize Bridge Kit & Find Chains

```typescript
// Initialize Bridge Kit instance
const kit = new BridgeKit();

// Get all supported chains from Bridge Kit
const supportedChains = kit.getSupportedChains();

// Determine source and destination based on direction
const isSepoliaToArc = direction === 'sepolia-to-arc';
const sourceChainId = isSepoliaToArc ? SEPOLIA_CHAIN_ID : ARC_CHAIN_ID;
const destinationChainId = isSepoliaToArc ? ARC_CHAIN_ID : SEPOLIA_CHAIN_ID;

// Find source chain in supported chains
let sourceChain = supportedChains.find(c => {
  const isEVM = 'chainId' in c;
  if (!isEVM) return false;
  return c.chainId === sourceChainId;
});

// Find destination chain in supported chains
let destinationChain = supportedChains.find(c => {
  const isEVM = 'chainId' in c;
  if (!isEVM) return false;
  return c.chainId === destinationChainId;
});
```

### Step 5: Switch to Source Chain (if needed)

```typescript
// Check if user is already on the source chain
const isOnSourceChain = chainId === sourceChainId;

if (!isOnSourceChain) {
  // Request chain switch
  setState(prev => ({ ...prev, step: 'switching-network' }));
  await switchChain({ chainId: sourceChainId });
  
  // Wait for chain switch to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### Step 6: Execute Bridge Transaction

This is where Bridge Kit takes over and handles everything automatically:

```typescript
// Set state to indicate bridge is starting
setState(prev => ({ ...prev, step: 'approving' }));

// Execute the bridge
// Bridge Kit automatically handles:
// 1. Approval transaction (if needed) - user signs
// 2. Burn/Transfer transaction on source chain - user signs
// 3. Automatic chain switching to destination chain - Bridge Kit handles
// 4. Mint/Receive transaction on destination chain - user signs
// 
// The bridge() method only resolves after ALL steps complete successfully
// or if the user cancels at any point
const result = await kit.bridge({
  from: {
    adapter: adapter,           // Wallet adapter for source chain
    chain: sourceChain.chain,   // Source chain config (Sepolia or Arc)
  },
  to: {
    adapter: adapter,           // Same wallet adapter for destination chain
    chain: destinationChain.chain, // Destination chain config (Arc or Sepolia)
  },
  amount: amount,               // Amount to bridge (as string)
});
```

### Step 7: Extract Transaction Hashes

Bridge Kit returns a result object with a `steps` array containing transaction details:

```typescript
// Bridge Kit result structure:
// result.steps = [
//   { name: 'approve', state: 'completed', txHash: '0x...' },  // Approval tx
//   { name: 'burn', state: 'completed', txHash: '0x...' },     // Burn/transfer on source
//   { name: 'fetchAttestation', state: 'completed' },            // No txHash (data fetch)
//   { name: 'mint', state: 'completed', txHash: '0x...' }      // Mint/receive on destination
// ]

let sourceTxHash: string | undefined;
let receiveTxHash: string | undefined;

if (result.steps && Array.isArray(result.steps)) {
  result.steps.forEach((step) => {
    if (step.name === 'burn' && step.txHash) {
      // Burn/transfer transaction on source chain
      sourceTxHash = step.txHash;
    } else if (step.name === 'mint' && step.txHash) {
      // Mint/receive transaction on destination chain
      receiveTxHash = step.txHash;
    } else if (step.name === 'approve' && step.txHash && !sourceTxHash) {
      // Fallback: use approval tx as source if burn not found
      sourceTxHash = step.txHash;
    }
  });
}
```

### Step 8: Validate Completion

```typescript
// Only mark as success if we have the receive transaction hash
// The receiveTxHash confirms the bridge is fully complete on destination chain
if (!receiveTxHash) {
  // No receiveTxHash means transaction was cancelled or failed
  if (!sourceTxHash) {
    throw new Error('Transaction was cancelled. No tokens were bridged.');
  } else {
    throw new Error('Transaction was cancelled during receive step. Tokens may be in transit.');
  }
}

// If we reach here with receiveTxHash, bridge is complete
setState({
  step: 'success',
  error: null,
  result,
  isLoading: false,
  sourceTxHash,      // Transaction hash on source chain
  receiveTxHash,    // Transaction hash on destination chain
  direction,         // Store the direction used
});
```

---

## Error Handling

### User Cancellation Detection

```typescript
const errorStr = err.message || err.toString() || '';
const isUserRejection = 
  errorStr.includes('User rejected') || 
  errorStr.includes('User denied') ||
  errorStr.includes('rejected the request') ||
  errorStr.includes('cancelled') ||
  errorStr.includes('ACTION_REJECTED') ||
  errorStr.includes('4001'); // MetaMask error code

if (isUserRejection) {
  errorMessage = 'Transaction was cancelled. No tokens were bridged.';
}
```

### Wrong Token Contract Error

```typescript
if (err.message?.includes('Insufficient funds')) {
  // This usually means user has USDC from wrong contract
  errorMessage = `Wrong USDC Contract Address!
  
  Bridge Kit requires USDC at:
  ${tokenInfo.contractAddress}
  
  Your USDC is at a different contract address.
  Get USDC from the official Circle/Bridge Kit contract.`;
}
```

---

## Key Points

1. **Bridge Kit handles everything**: Approval, transfer, chain switching, and receive - all automatically
2. **Single method call**: `kit.bridge()` handles the entire flow
3. **Automatic chain switching**: Bridge Kit switches chains automatically during the process
4. **Completion confirmation**: Only succeeds if `receiveTxHash` exists (proves tokens arrived on destination)
5. **User can cancel**: At any step, user can cancel and Bridge Kit will stop gracefully
6. **Bidirectional**: Works both ways (Sepolia → Arc and Arc → Sepolia)

---

## Transaction Flow Diagram

```
User Initiates Bridge
    ↓
[Step 1] Switch to Source Chain (if needed)
    ↓
[Step 2] Bridge Kit: Request Token Approval (if needed)
    ↓ User Signs Approval
[Step 3] Bridge Kit: Burn/Transfer on Source Chain
    ↓ User Signs Transfer
[Step 4] Bridge Kit: Fetch Attestation (proof of burn)
    ↓
[Step 5] Bridge Kit: Automatically Switch to Destination Chain
    ↓
[Step 6] Bridge Kit: Mint/Receive on Destination Chain
    ↓ User Signs Receive
[Step 7] Bridge Complete ✅
    ↓
Return result with sourceTxHash and receiveTxHash
```

---

## State Management

The bridge state tracks the current step:

```typescript
type BridgeStep = 
  | 'idle'                    // Initial state
  | 'switching-network'       // Switching to source chain
  | 'approving'               // Requesting token approval
  | 'signing-bridge'          // Signing bridge transaction
  | 'waiting-receive-message' // Waiting for receive message
  | 'success'                 // Bridge completed successfully
  | 'error';                  // Error occurred
```

---

## Important Notes

- **Bridge Kit is atomic**: Either all steps complete or nothing happens (except approval, which can be done separately)
- **Tokens are burned on source**: On Sepolia, tokens are burned (not transferred)
- **Tokens are minted on destination**: On Arc, new tokens are minted (not transferred)
- **Attestation required**: Bridge Kit fetches attestation proof between chains
- **User must sign each transaction**: Approval, burn, and mint all require user signatures

