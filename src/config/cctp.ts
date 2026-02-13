/**
 * Circle CCTP (Cross-Chain Transfer Protocol) config for Forwarding Service.
 * Addresses from Circle's official contract list (testnet).
 * @see https://developers.circle.com/cctp/references/contract-addresses
 * @see https://developers.circle.com/cctp/howtos/transfer-usdc-with-forwarding-service
 */

// Iris API (testnet/sandbox) for fees and message status
export const CCTP_IRIS_API_BASE = "https://iris-api-sandbox.circle.com";

// Forwarding Service hook data: magic bytes "cctp-forward" + version 0 + length 0
export const FORWARDING_SERVICE_HOOK_DATA =
  "0x636374702d666f72776172640000000000000000000000000000000000000000" as `0x${string}`;

// Domain identifiers (CCTP chain IDs) – from Circle Supported Blockchains and Domains
export const CCTP_DOMAIN_SEPOLIA = 0;       // Ethereum Sepolia
export const CCTP_DOMAIN_AVALANCHE_FUJI = 1; // Avalanche Fuji
export const CCTP_DOMAIN_BASE_SEPOLIA = 6;  // Base Sepolia
export const CCTP_DOMAIN_ARC_TESTNET = 26;  // Arc Testnet

// Testnet TokenMessengerV2 – same address on all CCTP testnets
const TESTNET_TOKEN_MESSENGER =
  "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;

// Ethereum Sepolia (Domain 0)
export const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

// Avalanche Fuji (Domain 1) – CCTP testnet USDC
export const AVALANCHE_FUJI_USDC =
  "0x5425890298aed601595a70ab815c96711a31bc65" as `0x${string}`;

// Base Sepolia (Domain 6) – from Circle forwarding service sample
export const BASE_SEPOLIA_USDC =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

// Arc Testnet (Domain 26)
export const ARC_USDC =
  "0x3600000000000000000000000000000000000000" as `0x${string}`;

export function getCctpConfigForChain(chainId: number) {
  switch (chainId) {
    case 11155111:
      return { domain: CCTP_DOMAIN_SEPOLIA, usdc: SEPOLIA_USDC, tokenMessenger: TESTNET_TOKEN_MESSENGER };
    case 43113:
      return { domain: CCTP_DOMAIN_AVALANCHE_FUJI, usdc: AVALANCHE_FUJI_USDC, tokenMessenger: TESTNET_TOKEN_MESSENGER };
    case 84532:
      return { domain: CCTP_DOMAIN_BASE_SEPOLIA, usdc: BASE_SEPOLIA_USDC, tokenMessenger: TESTNET_TOKEN_MESSENGER };
    case 5042002:
      return { domain: CCTP_DOMAIN_ARC_TESTNET, usdc: ARC_USDC, tokenMessenger: TESTNET_TOKEN_MESSENGER };
    default:
      return null;
  }
}
