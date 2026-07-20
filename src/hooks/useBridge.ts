"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  pad,
  parseUnits,
} from "viem";
import { sepolia, baseSepolia, avalancheFuji } from "viem/chains";
import type { Chain } from "viem";
import {
  getCctpConfigForChain,
  CCTP_IRIS_API_BASE,
  FORWARDING_SERVICE_HOOK_DATA,
} from "../config/cctp";

export type BridgeToken = 'USDC';
export type BridgeStatus = "idle" | "bridging" | "success" | "error";
export type SupportedChain = "arc" | "ethereum" | "base" | "arbitrum" | "optimism";

// Chain IDs – from Circle CCTP testnet supported chains
export const SEPOLIA_CHAIN_ID = 11155111;       // Ethereum Sepolia (Domain 0)
export const AVALANCHE_FUJI_CHAIN_ID = 43113;   // Avalanche Fuji (Domain 1)
export const BASE_SEPOLIA_CHAIN_ID = 84532;     // Base Sepolia (Domain 6)
export const ARC_CHAIN_ID = 5042002;            // Arc Testnet (Domain 26)

export const CCTP_SUPPORTED_CHAIN_IDS = [
  SEPOLIA_CHAIN_ID,
  AVALANCHE_FUJI_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  ARC_CHAIN_ID,
] as const;

// Token configurations for BridgeModal compatibility (Circle testnet USDC addresses)
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string;
}

export const CHAIN_TOKENS: Record<number, Record<BridgeToken, TokenInfo>> = {
  [SEPOLIA_CHAIN_ID]: {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
  },
  [AVALANCHE_FUJI_CHAIN_ID]: {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contractAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
    },
  },
  [BASE_SEPOLIA_CHAIN_ID]: {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
  [ARC_CHAIN_ID]: {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contractAddress: '0x3600000000000000000000000000000000000000',
    },
  },
};

// Display names and explorer TX URLs for bridge UI
export const BRIDGE_CHAIN_NAMES: Record<number, string> = {
  [SEPOLIA_CHAIN_ID]: 'Sepolia',
  [AVALANCHE_FUJI_CHAIN_ID]: 'Avalanche Fuji',
  [BASE_SEPOLIA_CHAIN_ID]: 'Base Sepolia',
  [ARC_CHAIN_ID]: 'Arc Testnet',
};

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  switch (chainId) {
    case SEPOLIA_CHAIN_ID: return `https://sepolia.etherscan.io/tx/${txHash}`;
    case AVALANCHE_FUJI_CHAIN_ID: return `https://testnet.snowtrace.io/tx/${txHash}`;
    case BASE_SEPOLIA_CHAIN_ID: return `https://sepolia.basescan.org/tx/${txHash}`;
    case ARC_CHAIN_ID: return `https://testnet.arcscan.app/tx/${txHash}`;
    default: return '#';
  }
}

export function useBridge() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sourceTxHash?: string; receiveTxHash?: string } | null>(null);
  const [sourceTxHash, setSourceTxHash] = useState<string | undefined>(undefined);
  const [receiveTxHash, setReceiveTxHash] = useState<string | undefined>(undefined);
  const [direction, setDirection] = useState<'sepolia-to-arc' | 'arc-to-sepolia' | undefined>(undefined);
  const [sourceChainIdState, setSourceChainIdState] = useState<number | undefined>(undefined);
  const [destChainIdState, setDestChainIdState] = useState<number | undefined>(undefined);

  function getChainAndRpc(chainId: number): { chain: Chain; rpc: string } {
    const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || "";
    switch (chainId) {
      case SEPOLIA_CHAIN_ID: {
        const rpc = ALCHEMY_API_KEY
          ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
          : "https://ethereum-sepolia-rpc.publicnode.com";
        return { chain: sepolia, rpc };
      }
      case AVALANCHE_FUJI_CHAIN_ID: {
        const rpc = ALCHEMY_API_KEY
          ? `https://avax-fuji.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
          : "https://api.avax-test.network/ext/bc/C/rpc";
        return { chain: avalancheFuji, rpc };
      }
      case BASE_SEPOLIA_CHAIN_ID: {
        const rpc = ALCHEMY_API_KEY
          ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
          : "https://sepolia.base.org";
        return { chain: baseSepolia, rpc };
      }
      case ARC_CHAIN_ID: {
        const rpc = ALCHEMY_API_KEY
          ? `https://arc-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
          : "https://rpc.blockdaemon.testnet.arc.io";
        const arcChain: Chain = {
          id: ARC_CHAIN_ID,
          name: "Arc Testnet",
          nativeCurrency: { decimals: 6, name: "USDC", symbol: "USDC" },
          rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } },
          blockExplorers: { default: { name: "Arc Explorer", url: "https://testnet.arcscan.app" } },
        };
        return { chain: arcChain, rpc };
      }
      default:
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  }

  const bridge = async (
    token: BridgeToken,
    amount: string,
    sourceChainId: number,
    destChainId: number
  ) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setBridgeStatus("bridging");
    setCurrentStep(0);
    setError(null);
    setSourceChainIdState(sourceChainId);
    setDestChainIdState(destChainId);
    setDirection(
      sourceChainId === SEPOLIA_CHAIN_ID && destChainId === ARC_CHAIN_ID
        ? "sepolia-to-arc"
        : sourceChainId === ARC_CHAIN_ID && destChainId === SEPOLIA_CHAIN_ID
          ? "arc-to-sepolia"
          : undefined
    );

    const sourceConfig = getCctpConfigForChain(sourceChainId);
    const destConfig = getCctpConfigForChain(destChainId);
    if (!sourceConfig || !destConfig) {
      const err = new Error("Unsupported chain for CCTP Forwarding Service");
      setError(err.message);
      setBridgeStatus("error");
      throw err;
    }

    if (chainId !== sourceChainId) {
      await switchChain({ chainId: sourceChainId });
      await new Promise((r) => setTimeout(r, 2000));
    }

    const { chain: sourceChain, rpc: sourceRpc } = getChainAndRpc(sourceChainId);
    const publicClient = createPublicClient({
      chain: sourceChain,
      transport: http(sourceRpc, { retryCount: 3, timeout: 10000 }),
    });

    const mintRecipient = address as `0x${string}`;

    try {
      const transferAmount = parseUnits(amount, 6);

      const feeRes = await fetch(
        `${CCTP_IRIS_API_BASE}/v2/burn/USDC/fees/${sourceConfig.domain}/${destConfig.domain}?forward=true`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );
      if (!feeRes.ok) {
        throw new Error(`CCTP fees API error: ${feeRes.status}`);
      }
      const fees: Array<{
        finalityThreshold: number;
        minimumFee: number;
        forwardFee: { low: number; med: number; high: number };
      }> = await feeRes.json();
      const feeData = fees[0] ?? fees[1];
      if (!feeData) {
        throw new Error("No fee data from CCTP API");
      }
      const forwardFee = BigInt(feeData.forwardFee.med);
      const protocolFee = BigInt(Math.floor(feeData.minimumFee * 10_000));
      const maxFee = forwardFee + protocolFee;
      const totalAmount = transferAmount + maxFee;

      setCurrentStep(1);
      const approveData = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "approve",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [sourceConfig.tokenMessenger, totalAmount],
      });
      const approveHash = await walletClient.sendTransaction({
        to: sourceConfig.usdc,
        data: approveData,
        chain: sourceChain,
      });
      setSourceTxHash(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setCurrentStep(2);
      const burnData = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "depositForBurnWithHook",
            stateMutability: "nonpayable",
            inputs: [
              { name: "amount", type: "uint256" },
              { name: "destinationDomain", type: "uint32" },
              { name: "mintRecipient", type: "bytes32" },
              { name: "burnToken", type: "address" },
              { name: "destinationCaller", type: "bytes32" },
              { name: "maxFee", type: "uint256" },
              { name: "minFinalityThreshold", type: "uint32" },
              { name: "hookData", type: "bytes" },
            ],
            outputs: [],
          },
        ],
        functionName: "depositForBurnWithHook",
        args: [
          totalAmount,
          destConfig.domain,
          pad(mintRecipient, { size: 32 }),
          sourceConfig.usdc,
          pad("0x", { size: 32 }),
          maxFee,
          1000,
          FORWARDING_SERVICE_HOOK_DATA,
        ],
      });
      const burnTxHash = await walletClient.sendTransaction({
        to: sourceConfig.tokenMessenger,
        data: burnData,
        // Some RPC providers on testnets can fail gas estimation for
        // complex contracts with “exceeds max transaction gas limit”.
        // Use a conservative static gas limit for the burn call.
        gas: 1_000_000n,
        chain: sourceChain,
      });
      setSourceTxHash(burnTxHash);
      await publicClient.waitForTransactionReceipt({ hash: burnTxHash });

      setCurrentStep(3);
      let forwardTxHash: string | undefined;
      const maxAttempts = 90;
      for (let i = 0; i < maxAttempts; i++) {
        const msgRes = await fetch(
          `${CCTP_IRIS_API_BASE}/v2/messages/${sourceConfig.domain}?transactionHash=${burnTxHash}`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );
        const data = (await msgRes.json()) as { messages?: Array<{ forwardTxHash?: string }> };
        if (data.messages?.[0]?.forwardTxHash) {
          forwardTxHash = data.messages[0].forwardTxHash;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!forwardTxHash) {
        const errMsg =
          "Bridge incomplete: Forwarding Service mint not yet available. Your tokens may still be in transit.";
        setError(errMsg);
        setBridgeStatus("error");
        setCurrentStep(0);
        throw new Error(errMsg);
      }

      setReceiveTxHash(forwardTxHash);
      setCurrentStep(4);
      setBridgeStatus("success");
      setResult({ sourceTxHash: burnTxHash, receiveTxHash: forwardTxHash });
      return { sourceTxHash: burnTxHash, receiveTxHash: forwardTxHash };
    } catch (err: unknown) {
      console.error("Bridge error:", err);
      let errorMsg = err instanceof Error ? err.message : "Bridge failed";
      if (errorMsg.includes("User rejected") || errorMsg.includes("User denied")) {
        errorMsg = "Transaction cancelled by user";
      } else if (errorMsg.includes("insufficient funds")) {
        errorMsg = "Insufficient funds for gas or USDC amount";
      } else if (errorMsg.includes("chain") || errorMsg.includes("network")) {
        errorMsg = "Network error. Ensure you're on the correct testnet and try again.";
      }
      setError(errorMsg);
      setBridgeStatus("error");
      setCurrentStep(0);
      throw new Error(errorMsg);
    }
  };

  const reset = () => {
    setBridgeStatus("idle");
    setCurrentStep(0);
    setError(null);
    setResult(null);
    setSourceTxHash(undefined);
    setReceiveTxHash(undefined);
    setDirection(undefined);
    setSourceChainIdState(undefined);
    setDestChainIdState(undefined);
  };

  return {
    bridge,
    bridgeStatus,
    currentStep,
    // BridgeModal compatibility
    state: {
      status: bridgeStatus,
      currentStep,
      error,
      result,
      isLoading: bridgeStatus === 'bridging',
      sourceTxHash,
      receiveTxHash,
      direction,
      sourceChainId: sourceChainIdState,
      destChainId: destChainIdState,
    },
    reset,
    isOnSepolia: chainId === SEPOLIA_CHAIN_ID,
    isOnAvalancheFuji: chainId === AVALANCHE_FUJI_CHAIN_ID,
    isOnBaseSepolia: chainId === BASE_SEPOLIA_CHAIN_ID,
    isOnArc: chainId === ARC_CHAIN_ID,
    currentChainId: chainId,
  };
}
