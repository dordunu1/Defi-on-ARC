# DeFi on Arc - Complete DEX & Bridge Platform

A full-featured DeFi application built on Arc Testnet featuring token swapping, liquidity provision, and cross-chain bridging between Ethereum Sepolia and Arc Testnet.

## 🚀 Features

### Token Swapping
- **Instant Swaps**: Swap tokens instantly using AMM pools
- **Real-time Price Charts**: Interactive price charts with 1H, 1D, 1W, 1M timeframes
- **Swap Activity Feed**: Live swap history for each token pair
- **Buy/Sell Indicators**: Visual tags showing swap direction
- **Token Logos**: Beautiful token logos throughout the UI

### Liquidity Provision
- **Add Liquidity**: Provide liquidity to any token pair
- **Remove Liquidity**: Withdraw your liquidity at any time
- **LP Token Tracking**: Track your liquidity positions
- **Pool Creation**: Create new pools for any token pair

### Cross-Chain Bridging
- **Bidirectional Bridging**: Bridge USDC from Sepolia ↔ Arc Testnet
- **Automatic Chain Switching**: Seamless chain transitions
- **Progress Tracking**: Real-time bridge status updates
- **Confetti Animation**: Celebration on successful bridge
- **Transaction Links**: Direct links to block explorers

### LP Farming (Staking)
- **Stake LP Tokens**: Stake your LP tokens to earn DOA rewards
- **Multi-Pool Support**: Farm rewards from multiple pools simultaneously
- **Real-time Rewards**: Track accumulated DOA rewards in real-time
- **Future Airdrop**: Rewards accumulate and will be distributed via airdrop
- **APY Display**: View current APY for each staking pool
- **USDC Pairs**: All USDC pairs automatically eligible for farming

### Analytics & Data
- **Pool Analytics**: TVL, volume, and fees tracking
- **Price History**: Historical price data for all pairs
- **Swap History**: Individual account swap history
- **Staking Stats**: Track staking positions and accumulated rewards
- **Real-time Updates**: Auto-refresh every 5 minutes

## 📁 Project Structure

```
my-bridge-app/
├── src/                          # Frontend React application
│   ├── components/              # React components
│   │   ├── ActivityTab.tsx     # User swap history
│   │   ├── AddLiquidityModal.tsx
│   │   ├── BridgeModal.tsx      # Cross-chain bridge UI
│   │   ├── CreatePool.tsx       # Pool creation interface
│   │   ├── LandingPage.tsx      # Landing page
│   │   ├── Liquidity.tsx        # Liquidity management
│   │   ├── Farming.tsx          # LP staking/farming interface
│   │   ├── Navigation.tsx      # App navigation
│   │   ├── Pools.tsx            # Pool listings & analytics
│   │   ├── PriceChart.tsx       # Price chart component
│   │   ├── RemoveLiquidityModal.tsx
│   │   ├── Swap.tsx             # Main swap interface
│   │   ├── SwapActivity.tsx     # Swap activity feed
│   │   ├── SwapSuccessModal.tsx
│   │   ├── TokenLogo.tsx        # Token logo component
│   │   └── XFollowFAB.tsx       # Social media FAB
│   ├── config/                  # Configuration files
│   │   ├── abis.ts              # Contract ABIs
│   │   ├── dex.ts               # DEX configuration
│   │   └── wagmi.ts             # Wagmi/RainbowKit config
│   ├── hooks/                    # Custom React hooks
│   │   ├── useBridge.ts         # Bridge functionality
│   │   ├── useDEX.ts            # DEX interactions
│   │   ├── useStaking.ts        # Staking/farming functionality
│   │   └── usePriceHistory.ts   # Price history fetching
│   ├── utils/                    # Utility functions
│   │   ├── addArcTestnet.ts     # Arc Testnet config
│   │   └── tokenLogos.ts        # Token logo mappings
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # App entry point
│   └── index.css                 # Global styles
│
├── contracts/                    # Smart contracts (Solidity)
│   ├── contracts/               # Solidity source files
│   │   ├── MockERC20.sol        # Test token contract
│   │   ├── PoolFactory.sol      # Factory for creating pools
│   │   ├── SimplePoolWithLP.sol # Liquidity pool contract
│   │   └── StakingRewards.sol   # LP staking/farming contract
│   ├── scripts/                  # Deployment scripts
│   │   ├── deploy.ts            # Deploy contracts
│   │   ├── deployStaking.ts     # Deploy staking contracts
│   │   ├── addUSDCpoolsToStaking.ts # Add USDC pairs to staking
│   │   ├── addInitialLiquidity.ts
│   │   └── recoverLiquidity.ts
│   ├── artifacts/               # Compiled contracts
│   ├── typechain-types/         # TypeScript types
│   ├── hardhat.config.ts        # Hardhat configuration
│   ├── package.json             # Contract dependencies
│   └── DEPLOYMENT_ADDRESSES.txt  # Deployed contract addresses
│
├── indexer/                      # Backend indexer service
│   ├── index.js                 # Main indexer script
│   ├── package.json             # Indexer dependencies
│   ├── railway.json             # Railway deployment config
│   └── nixpacks.toml            # Nixpacks config
│
├── public/                       # Static assets
│   ├── favicon.ico
│   └── *.png, *.svg             # Token logos
│
├── scripts/                      # Utility scripts
│   └── validate-liquidity.js
│
├── supabase-schema.sql          # Database schema
├── supabase-staking-schema.sql  # Staking database schema
├── supabase-migration-add-sender-address.sql
├── INDEXER_SETUP.md             # Indexer setup guide
├── STAKING_SETUP.md             # Staking/farming setup guide
├── LP_FARMING_EXPLAINED.md      # LP farming mechanics explained
├── SECURITY_ANALYSIS.md         # Security documentation
├── package.json                 # Frontend dependencies
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS config
└── tsconfig.json                # TypeScript config
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- MetaMask or compatible wallet
- USDC on Ethereum Sepolia or Arc Testnet (for bridging)
- Supabase account (for indexer)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/realchriswilder/defi.git
cd my-bridge-app
```

2. **Install frontend dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# Create .env file in root
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Start development server**
```bash
npm run dev
```

5. **Open the app**
Navigate to [http://localhost:5173](http://localhost:5173)

## 🔧 Smart Contracts Setup

### Contracts Overview

- **MockERC20.sol**: Test tokens with 18 decimals
- **SimplePoolWithLP.sol**: Liquidity pool with LP tokens
- **PoolFactory.sol**: Factory to create multiple pools

### Deploy Contracts

1. **Navigate to contracts directory**
```bash
cd contracts
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
```

3. **Compile contracts**
```bash
npm run compile
```

4. **Deploy to Arc Testnet**
```bash
npm run deploy:arc
```

5. **Add initial liquidity** (optional)
```bash
# Update addresses in scripts/addInitialLiquidity.ts
npm run add-liquidity
```

### Contract Math

The DEX uses the **Constant Product Formula** (x * y = k):

- **Swap**: `(reserveB * amountIn * (1 - fee)) / (reserveA + amountIn * (1 - fee))`
- **Add Liquidity**: LP tokens = `sqrt(amountA * amountB)`
- **Remove Liquidity**: Proportional to LP token share

### Deployment Addresses

Deployed contract addresses are stored in `contracts/DEPLOYMENT_ADDRESSES.txt`.

**Factory Address**: `0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C`

## 📊 Indexer Setup

The indexer listens to blockchain events and stores swap data in Supabase for analytics.

### Railway Deployment (Recommended)

1. **Create a new Railway service** (separate from frontend)
2. **Set Root Directory** to `/indexer`
3. **Set Service Type** to "Worker" (NOT "Web Service")
4. **Add Environment Variables**:
   - `WSS_URL` = `wss://rpc.testnet.arc.network`
   - `HTTP_RPC_URL` = `https://rpc.testnet.arc.network` (optional, defaults to Arc RPC)
   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_ANON_KEY` = Your Supabase anon key

### Local Development

```bash
cd indexer
npm install
npm start
```

### Database Setup

1. **Run Supabase schema**
   - Execute `supabase-schema.sql` in Supabase SQL Editor
   - Creates `swap_events`, `pools`, `price_history` tables

2. **Run migration** (if needed)
   - Execute `supabase-migration-add-sender-address.sql` to add `sender_address` column

### What the Indexer Does

- Polls every 10 seconds
- Tracks all pools from the factory
- Listens for Swap events
- Stores raw swap events in Supabase
- Updates pool reserves from on-chain data
- Calculates volume and fees

## 🌉 Bridge Setup

### Manual Arc Testnet Configuration

Add Arc Testnet to MetaMask:

- **Network Name**: Arc Testnet
- **RPC URL**: `https://arc-testnet.g.alchemy.com/v2/API KEY HERE`
- **Chain ID**: `5042002`
- **Currency Symbol**: `USDC`
- **Block Explorer**: `https://testnet.arcscan.app`
- **Decimals**: `6`

### Bridge Flow

1. **Select Direction**: Choose Sepolia → Arc or Arc → Sepolia
2. **Enter Amount**: Input USDC amount to bridge
3. **Approve**: Approve token spending
4. **Transfer**: Confirm transfer transaction
5. **Auto Switch**: Bridge Kit automatically switches chains
6. **Receive**: Confirm receive message transaction
7. **Success**: Confetti animation and transaction links!

### Token Addresses

- **Sepolia USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Arc Testnet USDC**: `0x3600000000000000000000000000000000000000`

### Get Testnet USDC

- **Sepolia**: [Circle Faucet](https://faucet.circle.com/)
- **Arc Testnet**: Arc Testnet Faucet

## 🎨 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Wagmi** - Ethereum interactions
- **RainbowKit** - Wallet connection
- **Lightweight Charts** - Price charts
- **Recharts** - Analytics charts

### Blockchain
- **Viem** - Ethereum library
- **Circle Bridge Kit** - Cross-chain bridging
- **Hardhat** - Smart contract development
- **Solidity** - Smart contract language

### Backend
- **Supabase** - Database & API
- **Node.js** - Indexer runtime
- **Railway** - Indexer hosting

## 📡 RPC Endpoints

### Indexer (Arc RPC Only)
- **HTTP**: `https://rpc.testnet.arc.network`
- **WebSocket**: `wss://rpc.testnet.arc.network`

### Frontend/Contracts (Optional - Alchemy for higher rate limits)
- **HTTP**: `https://arc-testnet.g.alchemy.com/v2/API_KEY_HERE` (optional)
- **Fallback**: `https://rpc.testnet.arc.network`

## 🔐 Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Indexer (Railway/Environment)
```env
WSS_URL=wss://rpc.testnet.arc.network
HTTP_RPC_URL=https://rpc.testnet.arc.network
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Contracts (.env in contracts/)
```env
PRIVATE_KEY=your_private_key
ARC_RPC_URL=https://arc-testnet.g.alchemy.com/v2/API KEY HERE 
```

## 📝 Usage Examples

### Using the Bridge Hook

```tsx
import { useBridge } from './hooks/useBridge';

function MyComponent() {
  const { state, tokenBalance, bridge, fetchTokenBalance } = useBridge();
  
  const handleBridge = async () => {
    // Bridge from Sepolia to Arc
    await bridge('USDC', '10', 'sepolia-to-arc');
  };
  
  return (
    <div>
      <p>Balance: {tokenBalance} USDC</p>
      <button onClick={handleBridge}>Bridge</button>
    </div>
  );
}
```

### Using the DEX Hook

```tsx
import { useDEX } from './hooks/useDEX';

function SwapComponent() {
  const { swap, addLiquidity, pools } = useDEX();
  
  const handleSwap = async () => {
    await swap(
      '0x...', // tokenIn
      '0x...', // tokenOut
      '1000000000000000000', // amountIn (in wei)
      '0' // minAmountOut
    );
  };
  
  return <button onClick={handleSwap}>Swap</button>;
}
```

## 🚢 Deployment

### Frontend (Vercel/Netlify)

```bash
npm run build
# Deploy dist/ folder
```

### Indexer (Railway)

1. Connect GitHub repository
2. Set root directory to `/indexer`
3. Set service type to "Worker"
4. Add environment variables
5. Deploy

## 🌾 LP Farming Setup

### Overview

LP Farming allows users to stake their LP tokens to earn DOA (reward token) rewards. Rewards accumulate over time and will be distributed via airdrop in the future.

### Quick Start

1. **Deploy Staking Contracts**
   ```bash
   cd contracts
   npm run deploy:staking
   ```

2. **Add USDC Pairs to Staking**
   ```bash
   npm run add-usdc-pools
   ```

3. **Update Frontend Config**
   - Add `DOA_TOKEN_ADDRESS` and `STAKING_REWARDS_ADDRESS` to `src/config/dex.ts`

4. **Set Up Database**
   - Run `supabase-staking-schema.sql` in Supabase SQL Editor

5. **Configure Indexer**
   - Add `STAKING_REWARDS_ADDRESS` environment variable to Railway indexer

### Features

- **1.5 DOA/sec** reward rate for all USDC pairs
- **Automatic Pool Detection**: All USDC pairs automatically added
- **Real-time Tracking**: Indexer updates staking data every 30 minutes
- **Future Airdrop**: Rewards accumulate but claiming is disabled for future distribution

### Documentation

- **STAKING_SETUP.md** - Complete staking setup guide
- **LP_FARMING_EXPLAINED.md** - How LP farming works and APY calculations

## 📚 Additional Documentation

- **INDEXER_SETUP.md** - Detailed indexer setup guide
- **STAKING_SETUP.md** - LP farming/staking setup guide
- **LP_FARMING_EXPLAINED.md** - LP farming mechanics and APY calculations
- **SECURITY_ANALYSIS.md** - Security considerations
- **contracts/CUSTOM_DEX_EXPLANATION.md** - DEX math explanation
- **contracts/CustomDEX_Guide.md** - Custom DEX guide

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🔗 Links

- **GitHub**: [https://github.com/realchriswilder/defi](https://github.com/realchriswilder/defi)
- **Arc Explorer**: [https://testnet.arcscan.app](https://testnet.arcscan.app)
- **Circle Bridge Kit**: [https://developers.circle.com/](https://developers.circle.com/)

---

Built with ❤️ on Arc Testnet
