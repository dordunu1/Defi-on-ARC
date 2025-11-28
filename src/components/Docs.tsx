import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, 
  Search, 
  Home, 
  FileText, 
  Network, 
  Droplets, 
  Factory, 
  Route, 
  BarChart3, 
  Zap, 
  Settings, 
  MapPin, 
  BookOpen 
} from 'lucide-react';
import { DEX_CONFIG } from '../config/dex';
import '../styles/neumorphic.css';

interface DocsProps {
  changelogOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DocContent {
  title: string;
  content: string;
}

const docsContent: Record<string, DocContent> = {
  welcome: {
    title: 'Welcome to DeFi on ARC',
    content: `# Welcome to DeFi on ARC

Welcome to the official documentation for **DeFi on ARC**—a decentralized exchange (DEX) built on the Arc Testnet, providing seamless token swapping, liquidity provision, and bridging capabilities.

## What is DeFi on ARC?

DeFi on ARC is a fully decentralized exchange that enables users to swap tokens, provide liquidity, and earn fees. Built with modern smart contract architecture, it supports direct swaps and multi-hop routing for optimal trade execution.

## Key Features

- **Direct Token Swaps**: Swap tokens directly through liquidity pools
- **Multi-Hop Routing**: Automatic pathfinding for tokens without direct pools
- **Liquidity Provision**: Add liquidity and earn trading fees
- **LP Tokens**: Receive LP tokens representing your liquidity position
- **Low Fees**: 0.3% trading fee on all swaps
- **USDC Pairs**: All pools must include USDC for standardization

## Who is it for?

- **Traders**: Swap tokens with minimal slippage and competitive rates
- **Liquidity Providers**: Earn fees by providing liquidity to pools
- **Developers**: Integrate DEX functionality into your applications
- **DeFi Enthusiasts**: Explore decentralized trading on Arc Testnet

---

Ready to dive in? Explore the documentation to understand the technical architecture and how to interact with the contracts.`
  },
  bridge: {
    title: 'Bridge',
    content: `# Bridge

The DeFi on ARC bridge utilizes **Circle Bridge Kit** to enable seamless token transfers between Ethereum Sepolia and Arc Testnet.

## What is Circle Bridge Kit?

Circle Bridge Kit is a production-ready SDK that simplifies cross-chain token transfers. It handles the entire bridging process including approvals, transfers, attestations, and destination chain minting.

## Supported Chains

- **Ethereum Sepolia** (Chain ID: 11155111) - Source/Destination
- **Arc Testnet** (Chain ID: 5042002) - Source/Destination

## Supported Tokens

Currently, only **USDC** is supported for bridging:

- Sepolia USDC: \`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238\`
- Arc Testnet USDC: \`0x3600000000000000000000000000000000000000\`

## How It Works

### Bridge Flow

The bridge process consists of several automated steps:

1. **Network Switching**: Automatically switches to source chain if needed
2. **Token Approval**: Approves Bridge Kit contract to spend tokens (if needed)
3. **Burn/Transfer**: Transfers tokens on source chain (burns on Sepolia, transfers on Arc)
4. **Attestation**: Circle's attestation service validates the transfer
5. **Chain Switch**: Automatically switches to destination chain
6. **Mint/Receive**: Mints or receives tokens on destination chain

### Bidirectional Bridging

The bridge supports transfers in both directions:

- **Sepolia → Arc**: USDC is burned on Sepolia and minted on Arc
- **Arc → Sepolia**: USDC is transferred on Arc and minted on Sepolia

## Implementation Details

### Bridge Kit Integration

The bridge uses \`@circle-fin/bridge-kit\` and \`@circle-fin/adapter-viem-v2\`:

\`\`\`typescript
import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-viem-v2';

// Create adapter from wallet provider
const adapter = await createAdapterFromProvider({
  provider: walletProvider,
});

// Initialize Bridge Kit
const kit = new BridgeKit();

// Execute bridge
const result = await kit.bridge({
  from: {
    adapter: adapter,
    chain: sourceChain,
  },
  to: {
    adapter: adapter,
    chain: destinationChain,
  },
  amount: amount,
});
\`\`\`

### Transaction Steps

Bridge Kit returns a result object with a \`steps\` array containing:

- **approve**: Approval transaction (if needed)
- **burn**: Burn/transfer transaction on source chain
- **fetchAttestation**: Attestation data retrieval
- **mint**: Mint/receive transaction on destination chain

### Transaction Hashes

The bridge extracts transaction hashes from the result:

- sourceTxHash: Transaction hash on source chain (from \`burn\` step)
- receiveTxHash: Transaction hash on destination chain (from \`mint\` step)

## User Experience

### Automatic Chain Switching

Bridge Kit automatically handles chain switching:
- Switches to source chain before transfer
- Switches to destination chain before receive
- No manual network switching required

### Progress Tracking

The bridge tracks progress through states:
- \`idle\`: Ready to bridge
- \`switching-network\`: Switching to source chain
- \`approving\`: Approving token spend
- \`signing-bridge\`: Signing bridge transaction
- \`waiting-receive-message\`: Waiting for attestation
- \`success\`: Bridge completed successfully
- \`error\`: Bridge failed

### Error Handling

Common errors and solutions:

- **User Rejection**: Transaction cancelled by user
- **Insufficient Funds**: Not enough tokens or gas
- **Wrong Token Contract**: Using incorrect USDC address
- **Network Issues**: RPC connection problems

## Security Features

- **Reentrancy Protection**: All operations are atomic
- **Attestation Validation**: Circle validates all transfers
- **Slippage Protection**: Built into Bridge Kit
- **Transaction Verification**: All transactions verified on-chain

## Gas Costs

Bridge operations require gas on both chains:
- **Source Chain**: Approval + Transfer/Burn
- **Destination Chain**: Mint/Receive

Estimated gas costs:
- **Sepolia → Arc**: ~150,000 gas (Sepolia) + ~100,000 gas (Arc)
- **Arc → Sepolia**: ~100,000 gas (Arc) + ~150,000 gas (Sepolia)

## Best Practices

1. **Check Balance**: Ensure sufficient tokens and gas on source chain
2. **Wait for Confirmation**: Don't close browser during bridge
3. **Verify Transactions**: Check transaction hashes on explorers
4. **Use Official USDC**: Only use Bridge Kit USDC contracts
5. **Network Stability**: Ensure stable internet connection

## Explorer Links

- **Sepolia**: https://sepolia.etherscan.io
- **Arc Testnet**: https://testnet.arcscan.app

## API Reference

### useBridge Hook

\`\`\`typescript
const {
  state,
  tokenBalance,
  isLoadingBalance,
  balanceError,
  fetchTokenBalance,
  bridge,
  reset,
  isOnSepolia,
  isOnArc,
  currentChainId,
} = useBridge();
\`\`\`

### Bridge Function

\`\`\`typescript
await bridge(
  token: 'USDC',
  amount: string,
  direction: 'sepolia-to-arc' | 'arc-to-sepolia'
);
\`\`\`

### Fetch Balance

\`\`\`typescript
await fetchTokenBalance('USDC', chainId);
\`\`\``
  },
  overview: {
    title: 'Overview',
    content: `# Overview

## System Architecture

DeFi on ARC consists of four core components working together to provide a complete DeFi experience:

### Core Components

1. **Bridge**: Cross-chain token transfers using Circle Bridge Kit (Sepolia ↔ Arc Testnet)
2. **PoolFactory**: Creates and manages liquidity pools
3. **SimplePoolWithLP**: Individual liquidity pool contracts with LP token support
4. **Router**: Enables multi-hop swaps and optimal routing

## How It Works

### Token Swapping

When you swap tokens, the system:

1. Checks if a direct pool exists between the two tokens
2. If not, finds the best path (usually via USDC)
3. Executes the swap(s) through the Router contract
4. Transfers output tokens to your wallet

### Liquidity Provision

When you add liquidity:

1. Pool is created automatically if it doesn't exist
2. You provide both tokens in the correct ratio
3. LP tokens are minted representing your share
4. You earn 0.3% of all trading fees proportionally

### Pool Structure

Each pool contains:
- **Token A & Token B**: The two tokens in the pool
- **Reserves**: Current balances of each token
- **LP Tokens**: ERC20 tokens representing liquidity shares
- **Trading Fee**: 0.3% collected on every swap

## Supported Networks

- **Arc Testnet** (Chain ID: 5042002) - Current deployment
- Mainnet deployment coming soon!

---

Learn more about each contract in the following sections.`
  },
  'simple-pool': {
    title: 'SimplePoolWithLP Contract',
    content: `# SimplePoolWithLP Contract

The **SimplePoolWithLP** contract is the core liquidity pool implementation. Each pool manages a pair of tokens and issues LP (Liquidity Provider) tokens to track ownership.

## Contract Address

Pools are created dynamically by the PoolFactory. Each token pair has its own pool address.

## Key Features

- **Constant Product Formula**: Uses x * y = k (Uniswap V2 style)
- **LP Token Support**: ERC20 tokens representing liquidity shares
- **Automatic Reserve Sync**: Reserves sync with actual token balances
- **Fee Collection**: 0.3% fee on all swaps (30 basis points)

## State Variables

\`\`\`solidity
IERC20 public tokenA;        // First token in the pair
IERC20 public tokenB;        // Second token in the pair
uint256 public reserveA;      // Current reserve of tokenA
uint256 public reserveB;      // Current reserve of tokenB
uint256 public constant FEE_BPS = 30;  // 0.3% fee (30 basis points)
\`\`\`

## Core Functions

### addLiquidity

Adds liquidity to the pool and mints LP tokens.

\`\`\`solidity
function addLiquidity(
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin
) external returns (uint256 liquidity)
\`\`\`

**Parameters:**
- \`amountADesired\`: Desired amount of token A
- \`amountBDesired\`: Desired amount of token B
- \`amountAMin\`: Minimum amount of token A (slippage protection)
- \`amountBMin\`: Minimum amount of token B (slippage protection)

**Returns:** Amount of LP tokens minted

**How it works:**
1. Syncs reserves to get current state
2. Calculates optimal amounts based on current ratio
3. Transfers tokens from user to pool
4. Mints LP tokens proportional to contribution
5. Updates reserves

**First Liquidity Provision:**
- Calculates liquidity as \`sqrt(amountA * amountB)\`
- Locks MINIMUM_LIQUIDITY (1000) to prevent first person from draining
- Remaining liquidity is minted to the provider

### removeLiquidity

Removes liquidity from the pool and burns LP tokens.

\`\`\`solidity
function removeLiquidity(
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to
) external returns (uint256 amountA, uint256 amountB)
\`\`\`

**Parameters:**
- \`liquidity\`: Amount of LP tokens to burn
- \`amountAMin\`: Minimum amount of token A to receive
- \`amountBMin\`: Minimum amount of token B to receive
- \`to\`: Address to receive the tokens

**Returns:** Amounts of token A and token B received

**How it works:**
1. Calculates proportional amounts based on LP share
2. Burns LP tokens
3. Transfers tokens to recipient
4. Updates reserves

### swapAToB

Swaps token A for token B.

\`\`\`solidity
function swapAToB(
    uint256 amountAIn,
    uint256 amountBOutMin,
    address to
) external returns (uint256 amountBOut)
\`\`\`

**Parameters:**
- \`amountAIn\`: Amount of token A to swap
- \`amountBOutMin\`: Minimum amount of token B to receive (slippage protection)
- \`to\`: Address to receive token B

**Returns:** Amount of token B received

### swapBToA

Swaps token B for token A.

\`\`\`solidity
function swapBToA(
    uint256 amountBIn,
    uint256 amountAOutMin,
    address to
) external returns (uint256 amountAOut)
\`\`\`

**Parameters:**
- \`amountBIn\`: Amount of token B to swap
- \`amountAOutMin\`: Minimum amount of token A to receive (slippage protection)
- \`to\`: Address to receive token A

**Returns:** Amount of token A received

## Swap Formula

The swap uses the constant product formula with fees:

\`\`\`solidity
amountOut = (amountInWithFee * reserveOut) / ((reserveIn * 10000) + amountInWithFee)
\`\`\`

Where:
- \`amountInWithFee = amountIn * (10000 - FEE_BPS)\` (9970 for 0.3% fee)
- \`FEE_BPS = 30\` (0.3% = 30 basis points)

This ensures the constant product \`(reserveA + amountA) * (reserveB - amountB) = k\` is maintained.

## Reserve Management

### _update()

Internal function that syncs reserves with actual token balances:

\`\`\`solidity
function _update() private {
    reserveA = tokenA.balanceOf(address(this));
    reserveB = tokenB.balanceOf(address(this));
    emit Sync(reserveA, reserveB);
}
\`\`\`

**Why this matters:**
- Ensures reserves always match reality
- Prevents reserve drift from external transfers
- Called automatically before and after swaps/liquidity operations

### sync()

Public function anyone can call to sync reserves:

\`\`\`solidity
function sync() external {
    _update();
}
\`\`\`

Useful for fixing pools if reserves become stale.

## Events

- \`Mint(address indexed sender, uint256 amountA, uint256 amountB)\`: Emitted when liquidity is added
- \`Burn(address indexed sender, uint256 amountA, uint256 amountB, address indexed to)\`: Emitted when liquidity is removed
- \`Swap(...)\`: Emitted on every swap
- \`Sync(uint256 reserveA, uint256 reserveB)\`: Emitted when reserves are updated

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **SafeERC20**: Safe token transfers using OpenZeppelin
- **Minimum Liquidity**: Prevents first person from draining pool
- **Slippage Protection**: All functions include minimum amount parameters`
  },
  'pool-factory': {
    title: 'PoolFactory Contract',
    content: `# PoolFactory Contract

The **PoolFactory** contract is responsible for creating and managing all liquidity pools in the DEX.

## Contract Address

\`\`\`
${DEX_CONFIG.FACTORY_ADDRESS}
\`\`\`

## Purpose

The Factory pattern ensures:
- **One Pool Per Pair**: Only one pool exists for each token pair
- **Consistent Pool Creation**: All pools use the same contract template
- **Easy Discovery**: Query all pools or find a specific pool

## Key Functions

### createPool

Creates a new liquidity pool for a token pair.

\`\`\`solidity
function createPool(address tokenA, address tokenB) external returns (address pool)
\`\`\`

**Parameters:**
- \`tokenA\`: Address of first token
- \`tokenB\`: Address of second token

**Returns:** Address of the created pool

**How it works:**
1. Validates tokens are different and not zero address
2. Sorts tokens by address (token0 < token1)
3. Checks pool doesn't already exist
4. Deploys new SimplePoolWithLP contract
5. Stores pool address in mapping (both directions)
6. Adds to allPools array
7. Emits PoolCreated event

**Important Notes:**
- Pools are created automatically when first liquidity is added
- Token order is normalized (lower address = token0)
- Pool address is stored in both directions for easy lookup

### getPool

Gets the pool address for a token pair.

\`\`\`solidity
function getPool(address tokenA, address tokenB) external view returns (address pool)
\`\`\`

**Parameters:**
- \`tokenA\`: Address of first token
- \`tokenB\`: Address of second token

**Returns:** Pool address (address(0) if pool doesn't exist)

**Example:**
\`\`\`solidity
address usdcPool = factory.getPool(USDC, SRAC);
if (usdcPool != address(0)) {
    // Pool exists, can swap
}
\`\`\`

### allPoolsLength

Gets the total number of pools created.

\`\`\`solidity
function allPoolsLength() external view returns (uint256)
\`\`\`

**Returns:** Total number of pools

### allPools

Array containing all pool addresses. Can be accessed with index:

\`\`\`solidity
address pool = factory.allPools(0);  // First pool
\`\`\`

## Storage Structure

\`\`\`solidity
mapping(address => mapping(address => address)) public pools;  // token0 => token1 => pool
address[] public allPools;  // All pool addresses
\`\`\`

The mapping stores pools with normalized token order, and also stores the reverse mapping for convenience.

## Events

- \`PoolCreated(address indexed tokenA, address indexed tokenB, address pool, uint256)\`: Emitted when a new pool is created

## Usage Example

\`\`\`solidity
// Create a new pool
address newPool = factory.createPool(USDC, SRAC);

// Check if pool exists
address pool = factory.getPool(USDC, SRAC);
require(pool != address(0), "Pool not found");

// Get total pools
uint256 totalPools = factory.allPoolsLength();
\`\`\``
  },
  router: {
    title: 'Router Contract',
    content: `# Router Contract

The **Router** contract enables multi-hop swaps and optimal routing when no direct pool exists between two tokens.

## Contract Address

\`\`\`
${DEX_CONFIG.ROUTER_ADDRESS}
\`\`\`

## Purpose

The Router provides:
- **Multi-Hop Swaps**: Swap tokens through intermediate pools
- **Path Finding**: Automatically finds best swap path
- **Optimal Routing**: Usually routes via USDC for best rates
- **Single Transaction**: All swaps happen atomically

## Key Functions

### swapExactTokensForTokens

Swaps exact amount of input tokens for minimum output tokens.

\`\`\`solidity
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to
) external returns (uint256[] memory amounts)
\`\`\`

**Parameters:**
- \`amountIn\`: Exact amount of input tokens
- \`amountOutMin\`: Minimum amount of output tokens (slippage protection)
- \`path\`: Array of token addresses [tokenIn, intermediate, ..., tokenOut]
- \`to\`: Address to receive output tokens

**Returns:** Array of amounts at each step

**Example Path:**
\`\`\`solidity
// Swap SRAC -> USDC -> RACS
address[] memory path = new address[](3);
path[0] = SRAC;
path[1] = USDC;
path[2] = RACS;
\`\`\`

### swapTokensForExactTokens

Swaps tokens for exact amount of output tokens.

\`\`\`solidity
function swapTokensForExactTokens(
    uint256 amountOut,
    uint256 amountInMax,
    address[] calldata path,
    address to
) external returns (uint256[] memory amounts)
\`\`\`

**Parameters:**
- \`amountOut\`: Exact amount of output tokens desired
- \`amountInMax\`: Maximum amount of input tokens (slippage protection)
- \`path\`: Array of token addresses
- \`to\`: Address to receive output tokens

**Returns:** Array of amounts at each step

### findBestPath

Finds the best swap path between two tokens.

\`\`\`solidity
function findBestPath(address tokenIn, address tokenOut) 
    external 
    view 
    returns (address[] memory path)
\`\`\`

**Parameters:**
- \`tokenIn\`: Input token address
- \`tokenOut\`: Output token address

**Returns:** Array of token addresses representing the path (empty if no path exists)

**Path Finding Logic:**
1. Checks if direct pool exists → returns [tokenIn, tokenOut]
2. Checks if path via USDC exists → returns [tokenIn, USDC, tokenOut]
3. Returns empty array if no path found

**Example:**
\`\`\`solidity
address[] memory path = router.findBestPath(SRAC, RACS);
// Returns: [SRAC, USDC, RACS] if direct pool doesn't exist
\`\`\`

### getAmountsOut

Calculates output amounts for a given input amount and path.

\`\`\`solidity
function getAmountsOut(uint256 amountIn, address[] calldata path)
    public
    view
    returns (uint256[] memory amounts)
\`\`\`

**Parameters:**
- \`amountIn\`: Input amount
- \`path\`: Array of token addresses

**Returns:** Array of output amounts at each step

**Use Case:** Estimate swap output before executing

### getAmountsIn

Calculates input amounts needed for a given output amount and path.

\`\`\`solidity
function getAmountsIn(uint256 amountOut, address[] calldata path)
    public
    view
    returns (uint256[] memory amounts)
\`\`\`

**Parameters:**
- \`amountOut\`: Desired output amount
- \`path\`: Array of token addresses

**Returns:** Array of input amounts at each step

## Internal Swap Execution

### _swap

Internal function that executes swaps through the path.

\`\`\`solidity
function _swap(
    uint256[] memory amounts,
    address[] memory path,
    address _to
) internal
\`\`\`

**How it works:**
1. Loops through each pair in the path
2. Gets pool address from factory
3. Approves pool to spend tokens
4. Calls pool's swap function
5. For intermediate hops, sends tokens to Router
6. For final hop, sends tokens to recipient

**Example Multi-Hop Flow:**
\`\`\`
SRAC -> USDC -> RACS

Step 1: Router receives SRAC from user
Step 2: Router swaps SRAC -> USDC (sends USDC to Router)
Step 3: Router swaps USDC -> RACS (sends RACS to user)
\`\`\`

## Swap Formula

Uses the same constant product formula as pools:

\`\`\`solidity
amountOut = (amountInWithFee * reserveOut) / ((reserveIn * 10000) + amountInWithFee)
\`\`\`

Where \`amountInWithFee = amountIn * 9970\` (0.3% fee)

## Events

- \`SwapExecuted(address indexed user, address[] path, uint256 amountIn, uint256 amountOut)\`: Emitted on every router swap

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **SafeERC20**: Safe token transfers
- **Path Validation**: Ensures all pools in path exist
- **Slippage Protection**: Minimum output amounts required`
  },
  'liquidity-pools': {
    title: 'Liquidity Pools',
    content: `# Liquidity Pools

Liquidity pools are the foundation of the DEX, enabling token swaps and providing liquidity providers with fee-earning opportunities.

## Pool Requirements

### USDC Pair Requirement

**All pools must include USDC** as one of the tokens. This ensures:
- **Standardization**: All tokens can be priced against USDC
- **Liquidity Concentration**: Better rates through shared liquidity
- **Multi-Hop Routing**: Easy pathfinding via USDC

### Token Pairing

- **Token A**: Must be USDC (0x3600...0000)
- **Token B**: Any ERC20 token on Arc Testnet
- **Ordering**: Tokens are sorted by address (lower address = token0)

## Adding Liquidity

### Process

1. **Approve Tokens**: User approves pool to spend tokens
2. **Calculate Ratio**: System calculates optimal amounts based on current reserves
3. **Transfer Tokens**: Tokens transferred to pool
4. **Mint LP Tokens**: LP tokens minted proportional to contribution
5. **Update Reserves**: Reserves synced with actual balances

### First Liquidity Provider

When adding liquidity to an empty pool:
- Liquidity calculated as \`sqrt(amountA * amountB)\`
- MINIMUM_LIQUIDITY (1000) is locked forever
- Remaining liquidity minted to provider

**Why MINIMUM_LIQUIDITY?**
- Prevents first person from draining pool
- Ensures pool always has some liquidity
- Standard Uniswap V2 pattern

### Subsequent Providers

When pool already has liquidity:
- Must provide tokens in correct ratio
- LP tokens minted based on share: \`min(amountA * totalSupply / reserveA, amountB * totalSupply / reserveB)\`
- Slippage protection ensures minimum amounts

## Removing Liquidity

### Process

1. **Burn LP Tokens**: User burns their LP tokens
2. **Calculate Amounts**: Proportional amounts calculated: \`amountA = (liquidity * reserveA) / totalSupply\`
3. **Transfer Tokens**: Tokens transferred to user
4. **Update Reserves**: Reserves synced

### Slippage Protection

All removal operations include:
- \`amountAMin\`: Minimum amount of token A to receive
- \`amountBMin\`: Minimum amount of token B to receive

Transaction reverts if amounts are below minimums.

## LP Tokens

### What are LP Tokens?

LP (Liquidity Provider) tokens are ERC20 tokens representing your share of a pool.

**Properties:**
- **ERC20 Standard**: Can be transferred, traded, etc.
- **Proportional Ownership**: Amount represents your share
- **Fee Earnings**: Fees accrue to LP token holders proportionally

### LP Token Calculation

**First Provider:**
\`\`\`
liquidity = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
\`\`\`

**Subsequent Providers:**
\`\`\`
liquidity = min(
    (amountA * totalSupply) / reserveA,
    (amountB * totalSupply) / reserveB
)
\`\`\`

### LP Token Value

Your position value:
\`\`\`
positionValue = (lpBalance / totalSupply) * (reserveA * priceA + reserveB * priceB)
\`\`\`

## Trading Fees

### Fee Structure

- **Fee Rate**: 0.3% (30 basis points)
- **Collection**: Fees stay in the pool (increase reserves)
- **Distribution**: Fees accrue to all LP token holders proportionally

### Fee Calculation

On every swap:
\`\`\`
fee = amountIn * 0.003
amountInWithFee = amountIn * 0.997
\`\`\`

The fee increases the pool's reserves, benefiting all liquidity providers.

## Reserve Management

### Automatic Sync

Reserves are automatically synced:
- Before every swap
- After every swap
- Before adding liquidity
- After adding liquidity
- Before removing liquidity
- After removing liquidity

### Manual Sync

Anyone can call \`sync()\` to update reserves:
\`\`\`solidity
pool.sync();  // Updates reserves to match actual balances
\`\`\`

**When to use:**
- If reserves become stale
- After external token transfers
- For frontend data accuracy`
  },
  'swap-mechanics': {
    title: 'Swap Mechanics',
    content: `# Swap Mechanics

Understanding how token swaps work in the DEX, including price calculation, slippage, and multi-hop routing.

## Constant Product Formula

The DEX uses the **constant product formula** (x * y = k) popularized by Uniswap V2.

### Formula

\`\`\`
(reserveA + amountA) * (reserveB - amountB) = k
\`\`\`

Where \`k\` is a constant that must remain the same before and after the swap.

### With Fees

The actual formula accounts for the 0.3% trading fee:

\`\`\`
amountOut = (amountInWithFee * reserveOut) / ((reserveIn * 10000) + amountInWithFee)
\`\`\`

Where:
- \`amountInWithFee = amountIn * 9970\` (10000 - 30 basis points)
- \`reserveIn\`: Reserve of input token
- \`reserveOut\`: Reserve of output token

## Price Impact

### What is Price Impact?

Price impact is the difference between the current price and the execution price due to the swap size.

**Formula:**
\`\`\`
priceImpact = (amountOut / amountIn) / (reserveOut / reserveIn) - 1
\`\`\`

### Factors Affecting Price Impact

1. **Swap Size**: Larger swaps = higher impact
2. **Pool Liquidity**: More liquidity = lower impact
3. **Reserve Ratio**: Imbalanced pools = higher impact

### Example

Pool: 1000 USDC / 2000 SRAC
- Current price: 0.5 USDC per SRAC
- Swap: 100 USDC for SRAC
- New reserves: 1100 USDC / ~1818 SRAC
- Execution price: ~0.055 USDC per SRAC
- Price impact: ~10%

## Slippage Protection

### What is Slippage?

Slippage is the difference between expected and actual execution price.

### Protection Mechanisms

All swap functions include minimum output parameters:

\`\`\`solidity
function swapAToB(
    uint256 amountAIn,
    uint256 amountBOutMin,  // Slippage protection
    address to
) external
\`\`\`

**How it works:**
- User sets \`amountBOutMin\` based on acceptable slippage
- If actual output < minimum, transaction reverts
- Protects against front-running and price movements

### Recommended Slippage

- **Stable Pairs**: 0.1% - 0.5%
- **Volatile Pairs**: 0.5% - 1.0%
- **Large Swaps**: 1.0% - 3.0%

## Multi-Hop Swaps

### When Are They Used?

Multi-hop swaps are used when:
- No direct pool exists between two tokens
- Better rates available through intermediate token
- Router automatically finds optimal path

### Path Finding

The Router's \`findBestPath\` function:

1. **Checks Direct Pool**: Looks for direct pool first
2. **Checks USDC Route**: Looks for path via USDC
3. **Returns Path**: Returns best path found

**Example:**
\`\`\`
SRAC -> RACS (no direct pool)
Router finds: SRAC -> USDC -> RACS
\`\`\`

### Execution Flow

1. User approves Router to spend input token
2. Router transfers input token from user
3. Router executes swaps through path:
   - Intermediate tokens sent to Router
   - Final token sent to user
4. All swaps happen atomically (single transaction)

### Gas Costs

Multi-hop swaps cost more gas:
- **Direct Swap**: ~60,000 gas
- **2-Hop Swap**: ~120,000 gas
- **3-Hop Swap**: ~180,000 gas

## Price Calculation

### Spot Price

Current price without considering swap impact:

\`\`\`
spotPrice = reserveB / reserveA
\`\`\`

### Execution Price

Actual price after swap:

\`\`\`
executionPrice = amountOut / amountIn
\`\`\`

### Effective Price

Price including fees:

\`\`\`
effectivePrice = (amountOut / amountIn) * (1 + fee)
\`\`\`

## Front-Running Protection

### MEV Considerations

The DEX includes several protections:
- **Slippage Limits**: Users set minimum output
- **Non-Reentrant**: Prevents reentrancy attacks
- **Atomic Swaps**: All operations happen in one transaction

### Best Practices

- Set appropriate slippage tolerance
- Use recent block data for price estimates
- Consider using private mempools for large swaps`
  },
  'technical-details': {
    title: 'Technical Details',
    content: `# Technical Details

Deep dive into the technical implementation, security considerations, and optimization strategies.

## Smart Contract Architecture

### Inheritance Hierarchy

**SimplePoolWithLP:**
\`\`\`solidity
contract SimplePoolWithLP is ERC20, ReentrancyGuard, Ownable
\`\`\`

- **ERC20**: LP token functionality
- **ReentrancyGuard**: Prevents reentrancy attacks
- **Ownable**: Pool ownership (currently unused, reserved for future)

**Router:**
\`\`\`solidity
contract Router is ReentrancyGuard
\`\`\`

- **ReentrancyGuard**: Prevents reentrancy attacks

**PoolFactory:**
\`\`\`solidity
contract PoolFactory
\`\`\`

- No inheritance (simple contract)

## Reserve Synchronization

### Why Sync Reserves?

Reserves can become stale if:
- External tokens are sent directly to pool
- Tokens are airdropped to pool
- Other contracts interact with pool

### Sync Mechanism

\`\`\`solidity
function _update() private {
    reserveA = tokenA.balanceOf(address(this));
    reserveB = tokenB.balanceOf(address(this));
    emit Sync(reserveA, reserveB);
}
\`\`\`

**Called:**
- Before every operation (to get current state)
- After every operation (to update state)
- Publicly via \`sync()\` function

### Benefits

- **Accuracy**: Reserves always match reality
- **Flexibility**: External contracts can interact
- **Reliability**: No stale data issues

## Gas Optimization

### Optimizations Used

1. **Unchecked Arithmetic**: Used in loops where overflow is impossible
2. **Storage Packing**: State variables packed efficiently
3. **External Functions**: View functions marked external
4. **Calldata**: Path arrays use calldata instead of memory

### Gas Costs (Approximate)

- **Create Pool**: ~2,000,000 gas
- **Add Liquidity**: ~150,000 gas
- **Remove Liquidity**: ~100,000 gas
- **Direct Swap**: ~60,000 gas
- **Multi-Hop Swap**: ~120,000 gas per hop

## Security Considerations

### Reentrancy Protection

All state-changing functions use \`nonReentrant\` modifier:

\`\`\`solidity
function swapAToB(...) external nonReentrant {
    // Swap logic
}
\`\`\`

### Safe Token Transfers

Uses OpenZeppelin's SafeERC20:

\`\`\`solidity
using SafeERC20 for IERC20;
tokenA.safeTransferFrom(msg.sender, address(this), amount);
\`\`\`

### Slippage Protection

All user-facing functions include minimum amount parameters.

### Access Control

- **Pool Functions**: Public (anyone can swap/add liquidity)
- **Factory**: Public (anyone can create pools)
- **Router**: Public (anyone can swap)

## Decimal Handling

### Token Decimals

Different tokens use different decimals:
- **USDC**: 6 decimals
- **Most ERC20**: 18 decimals

### Calculations

All calculations use raw token amounts (wei/smallest unit):
- No decimal conversion in contracts
- Frontend handles decimal formatting
- Reserves stored as uint256

### Example

\`\`\`
1 USDC = 1,000,000 (6 decimals)
1 SRAC = 1,000,000,000,000,000,000 (18 decimals)
\`\`\`

## Event Indexing

### Indexed Parameters

Events use indexed parameters for efficient filtering:

\`\`\`solidity
event Swap(
    address indexed sender,
    uint256 amountAIn,
    uint256 amountBIn,
    uint256 amountAOut,
    uint256 amountBOut,
    address indexed to
);
\`\`\`

**Indexed:** \`sender\`, \`to\` (for filtering by address)
**Not Indexed:** Amounts (for detailed querying)

## Error Handling

### Custom Errors (Future)

Solidity 0.8.4+ supports custom errors for gas savings:
\`\`\`solidity
error InsufficientLiquidity();
error SlippageTooHigh();
\`\`\`

Currently uses \`require\` statements with strings.

## Upgradeability

### Current State

- **Pools**: Not upgradeable (immutable)
- **Factory**: Not upgradeable (immutable)
- **Router**: Not upgradeable (immutable)

### Future Considerations

- Proxy patterns for upgradeability
- Governance for parameter changes
- Fee adjustments via governance`
  },
  'contract-addresses': {
    title: 'Contract Addresses',
    content: `# Contract Addresses

All deployed contract addresses on Arc Testnet (Chain ID: 5042002).

## Core Contracts

### PoolFactory

Address: \`${DEX_CONFIG.FACTORY_ADDRESS}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.FACTORY_ADDRESS}\`

**Purpose:** Creates and manages all liquidity pools

### Router

Address: \`${DEX_CONFIG.ROUTER_ADDRESS}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.ROUTER_ADDRESS}\`

**Purpose:** Enables multi-hop swaps and optimal routing

### USDC (Native)

Address: \`${DEX_CONFIG.USDC_ADDRESS}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.USDC_ADDRESS}\`

**Purpose:** Native USDC token on Arc Testnet (6 decimals)

## Deployed Tokens

### SRAC

Address: \`${DEX_CONFIG.TOKENS.SRAC}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.TOKENS.SRAC}\`

Decimals: 18

### RACS

Address: \`${DEX_CONFIG.TOKENS.RACS}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.TOKENS.RACS}\`

Decimals: 18

### SACS

Address: \`${DEX_CONFIG.TOKENS.SACS}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.TOKENS.SACS}\`

Decimals: 18

### KITTY

Address: \`${DEX_CONFIG.TOKENS.KITTY}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.TOKENS.KITTY}\`

Decimals: 18

### DOGG

Address: \`${DEX_CONFIG.TOKENS.DOGG}\`

Explorer: \`${DEX_CONFIG.EXPLORER_URL}/address/${DEX_CONFIG.TOKENS.DOGG}\`

Decimals: 18

## Pool Addresses

Pool addresses are created dynamically. To find a pool:

\`\`\`solidity
address pool = factory.getPool(tokenA, tokenB);
\`\`\`

Or query the factory's \`allPools\` array.

## Network Information

- **Network Name:** Arc Testnet
- **Chain ID:** 5042002
- **RPC URL:** https://rpc.testnet.arc.network
- **Explorer:** ${DEX_CONFIG.EXPLORER_URL}
- **Currency:** USDC (native)

## Verification

All contracts are verified on ArcScan. You can view:
- Source code
- ABI
- Read/write functions
- Transaction history

## Integration

To integrate the DEX into your application:

\`\`\`javascript
const FACTORY_ADDRESS = "${DEX_CONFIG.FACTORY_ADDRESS}";
const ROUTER_ADDRESS = "${DEX_CONFIG.ROUTER_ADDRESS}";
const USDC_ADDRESS = "${DEX_CONFIG.USDC_ADDRESS}";
\`\`\`

Or use inline addresses:

- Factory: \`${DEX_CONFIG.FACTORY_ADDRESS}\`
- Router: \`${DEX_CONFIG.ROUTER_ADDRESS}\`
- USDC: \`${DEX_CONFIG.USDC_ADDRESS}\``
  },
  'api-reference': {
    title: 'API Reference',
    content: `# API Reference

Complete function reference for all contracts.

## SimplePoolWithLP

### addLiquidity

\`\`\`solidity
function addLiquidity(
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin
) external nonReentrant returns (uint256 liquidity)
\`\`\`

Adds liquidity to the pool.

**Requirements:**
- Tokens must be approved
- Amounts must meet minimums
- Pool must have sufficient liquidity

### removeLiquidity

\`\`\`solidity
function removeLiquidity(
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to
) external nonReentrant returns (uint256 amountA, uint256 amountB)
\`\`\`

Removes liquidity from the pool.

**Requirements:**
- Must own LP tokens
- Amounts must meet minimums

### swapAToB

\`\`\`solidity
function swapAToB(
    uint256 amountAIn,
    uint256 amountBOutMin,
    address to
) external nonReentrant returns (uint256 amountBOut)
\`\`\`

Swaps token A for token B.

**Requirements:**
- Token A must be approved
- Output must meet minimum

### swapBToA

\`\`\`solidity
function swapBToA(
    uint256 amountBIn,
    uint256 amountAOutMin,
    address to
) external nonReentrant returns (uint256 amountAOut)
\`\`\`

Swaps token B for token A.

**Requirements:**
- Token B must be approved
- Output must meet minimum

### getAmountOut

\`\`\`solidity
function getAmountOut(uint256 amountIn, bool isTokenA) 
    external 
    view 
    returns (uint256 amountOut)
\`\`\`

Calculates output amount for a swap (view function).

### getReserves

\`\`\`solidity
function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB)
\`\`\`

Gets current pool reserves.

### sync

\`\`\`solidity
function sync() external
\`\`\`

Manually syncs reserves with actual balances.

## PoolFactory

### createPool

\`\`\`solidity
function createPool(address tokenA, address tokenB) external returns (address pool)
\`\`\`

Creates a new pool for a token pair.

**Requirements:**
- Tokens must be different
- Pool must not exist

### getPool

\`\`\`solidity
function getPool(address tokenA, address tokenB) external view returns (address pool)
\`\`\`

Gets pool address for a token pair.

### allPoolsLength

\`\`\`solidity
function allPoolsLength() external view returns (uint256)
\`\`\`

Gets total number of pools.

### allPools

\`\`\`solidity
address[] public allPools
\`\`\`

Array of all pool addresses.

## Router

### swapExactTokensForTokens

\`\`\`solidity
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to
) external nonReentrant returns (uint256[] memory amounts)
\`\`\`

Swaps exact input for minimum output.

### swapTokensForExactTokens

\`\`\`solidity
function swapTokensForExactTokens(
    uint256 amountOut,
    uint256 amountInMax,
    address[] calldata path,
    address to
) external nonReentrant returns (uint256[] memory amounts)
\`\`\`

Swaps for exact output with maximum input.

### findBestPath

\`\`\`solidity
function findBestPath(address tokenIn, address tokenOut) 
    external 
    view 
    returns (address[] memory path)
\`\`\`

Finds best swap path between two tokens.

### getAmountsOut

\`\`\`solidity
function getAmountsOut(uint256 amountIn, address[] calldata path)
    public
    view
    returns (uint256[] memory amounts)
\`\`\`

Calculates output amounts for a path.

### getAmountsIn

\`\`\`solidity
function getAmountsIn(uint256 amountOut, address[] calldata path)
    public
    view
    returns (uint256[] memory amounts)
\`\`\`

Calculates input amounts needed for a path.`
  }
};

const navItems = [
  { id: 'welcome', title: 'Welcome', icon: Home },
  { id: 'overview', title: 'Overview', icon: FileText },
  { id: 'bridge', title: 'Bridge', icon: Network },
  { id: 'simple-pool', title: 'SimplePoolWithLP', icon: Droplets },
  { id: 'pool-factory', title: 'PoolFactory', icon: Factory },
  { id: 'router', title: 'Router', icon: Route },
  { id: 'liquidity-pools', title: 'Liquidity Pools', icon: BarChart3 },
  { id: 'swap-mechanics', title: 'Swap Mechanics', icon: Zap },
  { id: 'technical-details', title: 'Technical Details', icon: Settings },
  { id: 'contract-addresses', title: 'Contract Addresses', icon: MapPin },
  { id: 'api-reference', title: 'API Reference', icon: BookOpen },
];

const NeumorphicToggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <label className="neumorphic-toggle absolute top-4 right-6 z-10" style={{ cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      style={{ display: 'none' }}
    />
    <span className={`toggle-slider ${checked ? 'on' : ''}`}></span>
  </label>
);

export default function Docs({ changelogOpen = false, isOpen: externalIsOpen, onOpenChange }: DocsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<string>('welcome');
  const [searchTerm, setSearchTerm] = useState('');

  // Sync external isOpen prop with internal state
  useEffect(() => {
    if (externalIsOpen === undefined) return;
    
    if (externalIsOpen) {
      // Open the modal
      if (!isOpen) {
        setIsClosing(false);
        setIsOpen(true);
      }
    } else {
      // Close the modal with animation
      if (isOpen && !isClosing) {
        setIsClosing(true);
        setTimeout(() => {
          setIsOpen(false);
          setTimeout(() => {
            setIsClosing(false);
          }, 300);
        }, 700);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalIsOpen]);

  const filteredNavItems = navItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';
    let codeBlockIndex = 0;

    lines.forEach((line, index) => {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          const code = codeBlockContent.join('\n');
          elements.push(
            <pre key={`code-${codeBlockIndex}`} className="bg-orange-100 border border-orange-200 text-gray-900 p-4 rounded-lg overflow-x-auto mb-4 mt-4">
              <code className="text-sm font-mono block whitespace-pre">{code}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
          codeBlockIndex++;
        } else {
          // Start of code block
          codeBlockLanguage = line.substring(3).trim();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={index} className="text-2xl sm:text-3xl font-bold text-orange-600 mb-4 mt-6">{line.substring(2)}</h1>);
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={index} className="text-xl sm:text-2xl font-bold text-orange-600 mb-3 mt-6">{line.substring(3)}</h2>);
        return;
      }
      if (line.startsWith('### ')) {
        elements.push(<h3 key={index} className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 mt-4">{line.substring(4)}</h3>);
        return;
      }
      if (line.startsWith('#### ')) {
        elements.push(<h4 key={index} className="text-base sm:text-lg font-semibold text-gray-700 mb-2 mt-3">{line.substring(5)}</h4>);
        return;
      }

      // Lists
      if (line.startsWith('- ')) {
        const listContent = line.substring(2);
        const processInline = (text: string) => {
          if (text.includes('`')) {
            const parts = text.split('`');
            return parts.map((part, i) =>
              i % 2 === 1 ? (
                <code key={i} className="bg-orange-100 px-2 py-1 rounded text-xs sm:text-sm font-mono text-gray-900">
                  {part}
                </code>
              ) : (
                part
              )
            );
          }
          if (text.includes('**')) {
            const parts = text.split('**');
            return parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="font-bold text-gray-900">{part}</strong> : part
            );
          }
          return text;
        };

        elements.push(
          <li key={index} className="ml-4 mb-2 text-sm sm:text-base text-gray-700">
            {processInline(listContent)}
          </li>
        );
        return;
      }

      // Code inline (but not code blocks)
      if (line.includes('`') && !line.startsWith('```')) {
        const parts = line.split('`');
        const processedParts = parts.map((part, i) =>
          i % 2 === 1 ? (
            <code key={i} className="bg-orange-100 px-2 py-1 rounded text-xs sm:text-sm font-mono text-gray-900">
              {part}
            </code>
          ) : (
            part
          )
        );
        elements.push(
          <p key={index} className="mb-3 text-sm sm:text-base text-gray-700 leading-relaxed">
            {processedParts}
          </p>
        );
        return;
      }

      // Bold text (but not in lists or code)
      if (line.includes('**') && !line.startsWith('- ') && !line.includes('`')) {
        const parts = line.split('**');
        elements.push(
          <p key={index} className="mb-3 text-sm sm:text-base text-gray-700 leading-relaxed">
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="font-bold text-gray-900">{part}</strong> : part
            )}
          </p>
        );
        return;
      }

      // Empty lines
      if (line.trim() === '') {
        elements.push(<div key={index} className="mb-2"></div>);
        return;
      }

      // Regular paragraphs
      if (line.trim()) {
        elements.push(<p key={index} className="mb-3 text-sm sm:text-base text-gray-700 leading-relaxed">{line}</p>);
      }
    });

    // Handle any remaining code block
    if (inCodeBlock && codeBlockContent.length > 0) {
      const code = codeBlockContent.join('\n');
      elements.push(
        <pre key={`code-${codeBlockIndex}`} className="bg-orange-100 border border-orange-200 text-gray-900 p-4 rounded-lg overflow-x-auto mb-4 mt-4">
          <code className="text-sm font-mono block whitespace-pre">{code}</code>
        </pre>
      );
    }

    return elements;
  };

  return (
    <>
      {/* Docs Modal */}
      <AnimatePresence>
        {(isOpen || isClosing) && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => {
                if (!isClosing) {
                  setIsClosing(true);
                  setTimeout(() => {
                    setIsOpen(false);
                    setTimeout(() => {
                      setIsClosing(false);
                      onOpenChange?.(false);
                    }, 300); // Wait for exit animation
                  }, 700);
                }
              }}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-2 sm:inset-4 md:inset-8 lg:inset-12 max-w-7xl mx-auto bg-white/70 backdrop-blur-xl rounded-3xl sm:rounded-3xl z-50 flex flex-col overflow-hidden border border-white/30"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                y: 0
              }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow: `
                  inset 0 1px 0 rgba(255, 255, 255, 0.9),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                  0 0 30px rgba(251, 146, 60, 0.15),
                  0 0 60px rgba(251, 146, 60, 0.1),
                  0 10px 30px rgba(0, 0, 0, 0.1),
                  0 4px 8px rgba(0, 0, 0, 0.05)
                `,
              }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500/90 to-orange-600/90 backdrop-blur-md text-white p-4 md:p-6 flex items-center justify-between border-b border-orange-400/30 relative">
                <div className="flex items-center gap-3">
                  <Book className="w-6 h-6 md:w-8 md:h-8" />
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold">DeFi on ARC Documentation</h1>
                    <p className="text-sm text-orange-100">Complete technical guide</p>
                  </div>
                </div>
                <NeumorphicToggle
                  checked={isOpen && !isClosing}
                  onChange={(checked) => {
                    if (!checked && isOpen) {
                      // Show red state transition (0.4s) + brief pause (0.3s) before closing
                      setIsClosing(true);
                      setTimeout(() => {
                        setIsOpen(false);
                        setTimeout(() => {
                          setIsClosing(false);
                          onOpenChange?.(false);
                        }, 300); // Wait for exit animation to complete
                      }, 700);
                    } else if (checked && !isOpen) {
                      setIsOpen(true);
                      setIsClosing(false);
                      onOpenChange?.(true);
                    }
                  }}
                />
              </div>

              {/* Content */}
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 lg:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/20 bg-white/40 backdrop-blur-lg overflow-y-auto max-h-48 md:max-h-none">
                  <div className="p-3 sm:p-4 sticky top-0 bg-white/60 backdrop-blur-md border-b border-white/30 z-10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search docs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-lg focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 text-sm"
                        style={{
                          boxShadow: `
                            inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                            inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                            0 2px 4px rgba(0, 0, 0, 0.05)
                          `,
                        }}
                      />
                    </div>
                  </div>

                  <nav className="p-2 sm:p-4 space-y-1">
                    {filteredNavItems.map((item) => {
                      const isComingSoon = item.id === 'api-reference';
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (!isComingSoon) {
                              setCurrentDoc(item.id);
                            }
                          }}
                          disabled={isComingSoon}
                          className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition text-left ${
                            isComingSoon
                              ? 'text-gray-400 cursor-not-allowed opacity-60'
                              : currentDoc === item.id
                              ? 'bg-orange-100/80 backdrop-blur-sm text-orange-700 font-semibold'
                              : 'text-gray-600 hover:bg-white/60 hover:text-orange-600'
                          }`}
                          style={currentDoc === item.id && !isComingSoon ? {
                            boxShadow: `
                              inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                              inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                            `,
                          } : {}}
                          title={isComingSoon ? 'Coming soon' : ''}
                        >
                          {React.createElement(item.icon, { className: "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" })}
                          <span className="text-xs sm:text-sm">{item.title}</span>
                          {isComingSoon && (
                            <span className="ml-auto text-xs text-gray-400 italic">(Coming soon)</span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 bg-white/30 backdrop-blur-sm">
                  <div className="max-w-3xl mx-auto">
                    {renderMarkdown(docsContent[currentDoc]?.content || docsContent.welcome.content)}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
