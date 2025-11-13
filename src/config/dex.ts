// DEX Contract Addresses on Arc Testnet
// Deployed: [Date of deployment]
// Network: Arc Testnet (Chain ID: 5042002)

export const DEX_CONFIG = {
  // Factory Contract
  FACTORY_ADDRESS: "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C",
  
  // Router Contract (for multi-hop swaps)
  ROUTER_ADDRESS: "0x284C5Afc100ad14a458255075324fA0A9dfd66b1" as `0x${string}`,
  
  // Token Addresses (Optional - only if you want to use predefined tokens)
  // Users can use any ERC20 tokens, not just these
  // Deployed with 10M supply each
  TOKENS: {
    SRAC: "0x49cd69442dB073E7b94B0124e316AB7C68b95988",
    RACS: "0x6E63e2cABECCe5c3A1c37b79A958a9542076A1e3",
    SACS: "0x63F856fBAB3535174bFaFD6EFd720C634d6FD458",
    // KITTY and DOGG - deployed tokens
    KITTY: "0xe470A3Fb08345FD4a84c1b56Bd35bA7Be6297C3d" as `0x${string}`,
    DOGG: "0x832Fa4331050045F911bD6d59EAD144A04B965cB" as `0x${string}`,
  },
  
  // USDC Address (Arc Testnet native USDC)
  USDC_ADDRESS: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  
  // Note: Pools are now fetched dynamically from the factory contract
  // No need for hardcoded pool addresses
  
  // Network Info
  CHAIN_ID: 5042002,
  EXPLORER_URL: "https://testnet.arcscan.app",
};

