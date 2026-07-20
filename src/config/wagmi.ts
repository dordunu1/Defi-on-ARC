import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, baseSepolia, avalancheFuji } from 'viem/chains';

// Multiple Sepolia RPC endpoints for better reliability and rate limit handling
// Free tier RPCs have rate limits, so we use multiple fallbacks
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || '';

// Arc Testnet RPC endpoints - Blockdaemon public RPC as primary
const ARC_RPC_URLS = [
  'https://rpc.blockdaemon.testnet.arc.io', // Blockdaemon Arc Testnet RPC (primary)
  ...(ALCHEMY_API_KEY ? [`https://arc-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`] : []), // Alchemy as fallback only
];

// Use first RPC as primary
const ARC_RPC_URL = ARC_RPC_URLS[0];
const SEPOLIA_RPC_URLS = ALCHEMY_API_KEY
  ? [
    'https://ethereum-sepolia-rpc.publicnode.com', // PublicNode (primary - no rate limits)
    'https://rpc.sepolia.org', // Sepolia Foundation (fallback 1 - reliable)
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, // Alchemy (fallback 2 - use last to avoid rate limits)
  ]
  : [
    'https://ethereum-sepolia-rpc.publicnode.com', // PublicNode (primary)
    'https://rpc.sepolia.org', // Sepolia Foundation (fallback)
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Infura (fallback)
  ];

// Use first RPC as primary, but wagmi will fallback to others if needed
const SEPOLIA_PRIMARY_RPC = SEPOLIA_RPC_URLS[0];

// Custom Sepolia chain with multiple RPC fallbacks
const sepoliaWithCustomRpc = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: { http: SEPOLIA_RPC_URLS },
    public: { http: SEPOLIA_RPC_URLS },
  },
};

// Arc Testnet configuration
// Note: MetaMask validation requires 18 decimals for nativeCurrency
// Even though Arc Testnet uses USDC with 6 decimals, we use 18 here to satisfy MetaMask
// Actual transactions will still use the correct 6 decimals for USDC
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 18, // MetaMask requires 18, though Arc uses USDC with 6 decimals
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ARC_RPC_URLS },
    public: { http: ARC_RPC_URLS },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
} as const;

// Base Sepolia and Avalanche Fuji – CCTP testnets (Circle)
const baseSepoliaWithCustomRpc = {
  ...baseSepolia,
  rpcUrls: {
    ...baseSepolia.rpcUrls,
    default: {
      http: ALCHEMY_API_KEY
        ? [`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 'https://sepolia.base.org']
        : ['https://sepolia.base.org'],
    },
    public: { http: ['https://sepolia.base.org'] },
  },
};

const avalancheFujiWithCustomRpc = {
  ...avalancheFuji,
  rpcUrls: {
    ...avalancheFuji.rpcUrls,
    default: {
      http: ALCHEMY_API_KEY
        ? [`https://avax-fuji.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 'https://api.avax-test.network/ext/bc/C/rpc']
        : ['https://api.avax-test.network/ext/bc/C/rpc'],
    },
    public: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] },
  },
};

export const config = getDefaultConfig({
  appName: 'Bridge Kit App',
  projectId: 'ed1deffe285a3c80426c7502b6b773dd',
  chains: [sepoliaWithCustomRpc, baseSepoliaWithCustomRpc, avalancheFujiWithCustomRpc, arcTestnet],
});

// Export Arc RPC URLs for use in other components
export { ARC_RPC_URLS, ARC_RPC_URL };

