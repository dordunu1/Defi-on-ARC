"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { EIP1193Provider } from "viem";

export type BridgeToken = 'USDC';
export type BridgeStatus = "idle" | "bridging" | "success" | "error";
export type SupportedChain = "arc" | "ethereum" | "base" | "arbitrum" | "optimism";

// Bridge Kit Chain Identifiers (testnet format: Chain_Network)
const CHAIN_MAPPING: Record<SupportedChain, string> = {
  arc: "Arc_Testnet",
  ethereum: "Ethereum_Sepolia",
  base: "Base_Sepolia",
  arbitrum: "Arbitrum_Sepolia",
  optimism: "Optimism_Sepolia",
};

// Chain IDs
export const SEPOLIA_CHAIN_ID = 11155111;
export const ARC_CHAIN_ID = 5042002;

// Token configurations for BridgeModal compatibility
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string;
}

export const CHAIN_TOKENS: Record<number, Record<BridgeToken, TokenInfo>> = {
  [11155111]: {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
  },
  [5042002]: {
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contractAddress: '0x3600000000000000000000000000000000000000',
    },
  },
};

export function useBridge() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [kit, setKit] = useState<BridgeKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [sourceTxHash, setSourceTxHash] = useState<string | undefined>(undefined);
  const [receiveTxHash, setReceiveTxHash] = useState<string | undefined>(undefined);
  const [direction, setDirection] = useState<'sepolia-to-arc' | 'arc-to-sepolia' | undefined>(undefined);

  useEffect(() => {
    const bridgeKit = new BridgeKit();
    bridgeKit.on("approve", () => setCurrentStep(1));
    bridgeKit.on("burn", () => setCurrentStep(2));
    bridgeKit.on("fetchAttestation", () => setCurrentStep(3));
    bridgeKit.on("mint", () => setCurrentStep(4));
    setKit(bridgeKit);
  }, []);

  const bridge = async (
    token: BridgeToken,
    amount: string,
    bridgeDirection: 'sepolia-to-arc' | 'arc-to-sepolia'
  ) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }
    if (!kit) {
      throw new Error("Bridge Kit not initialized");
    }

    setBridgeStatus("bridging");
    setCurrentStep(0);
    setError(null);
    setDirection(bridgeDirection);

    const fromChain: SupportedChain = bridgeDirection === 'sepolia-to-arc' ? 'ethereum' : 'arc';
    const toChain: SupportedChain = bridgeDirection === 'sepolia-to-arc' ? 'arc' : 'ethereum';
    const sourceChainId = bridgeDirection === 'sepolia-to-arc' ? SEPOLIA_CHAIN_ID : ARC_CHAIN_ID;

    // Switch to source chain if needed
    if (chainId !== sourceChainId) {
      await switchChain({ chainId: sourceChainId });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      const provider = walletClient as unknown as EIP1193Provider;
      const adapter = await createAdapterFromProvider({ provider });
      const arcChainVariants = ["Arc_Testnet", "Arc", "ARC"];
      const needsArcVariant = fromChain === "arc" || toChain === "arc";
      let result;

      if (needsArcVariant) {
        for (const arcChain of arcChainVariants) {
          try {
            result = await kit.bridge({
              from: {
                adapter,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                chain: (fromChain === "arc" ? arcChain : CHAIN_MAPPING[fromChain]) as any,
              },
              to: {
                adapter,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                chain: (toChain === "arc" ? arcChain : CHAIN_MAPPING[toChain]) as any,
              },
              amount,
            });
            break;
          } catch (err: unknown) {
            if (err instanceof Error && err?.message?.includes("Invalid chain")) {
              if (arcChain === arcChainVariants[arcChainVariants.length - 1]) {
                throw new Error("Arc Testnet is not supported by Bridge Kit. Available chains: Ethereum_Sepolia, Base_Sepolia, Arbitrum_Sepolia, Avalanche_Fuji, Polygon_Amoy, Optimism_Sepolia");
              }
            } else {
              throw err;
            }
          }
        }
      } else {
        result = await kit.bridge({
          from: {
            adapter,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chain: CHAIN_MAPPING[fromChain] as any,
          },
          to: {
            adapter,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chain: CHAIN_MAPPING[toChain] as any,
          },
          amount,
        });
      }

      // Extract transaction hashes
      const resultAny = result as any;
      let extractedSourceTx: string | undefined;
      let extractedReceiveTx: string | undefined;
      
      if (resultAny?.steps) {
        resultAny.steps.forEach((step: any) => {
          if (step.name === 'burn' && step.txHash) {
            extractedSourceTx = step.txHash;
            setSourceTxHash(step.txHash);
          }
          if (step.name === 'mint' && step.txHash) {
            extractedReceiveTx = step.txHash;
            setReceiveTxHash(step.txHash);
          }
          if (step.name === 'approve' && step.txHash && !extractedSourceTx) {
            extractedSourceTx = step.txHash;
            setSourceTxHash(step.txHash);
            }
        });
      }

      // Wait a bit for the event listeners to update currentStep (mint event fires asynchronously)
      // The mint event listener will set currentStep to 4, but we check the transaction hash
      // which is the definitive proof that the mint transaction was created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark as success if we have receiveTxHash (mint transaction was created)
      // The currentStep will be updated by the event listener, but the hash is the source of truth
      if (extractedReceiveTx) {
        setResult(result);
        setBridgeStatus("success");
        // Ensure currentStep is set to 4 if the event hasn't fired yet
        if (currentStep < 4) {
          setCurrentStep(4);
        }
      } else {
        // If mint transaction hash wasn't found, treat as error
        const errorMsg = "Bridge incomplete: Mint transaction was not completed. Your tokens may still be in transit.";
        setError(errorMsg);
        setBridgeStatus("error");
        setCurrentStep(0);
        throw new Error(errorMsg);
      }
      
      return result;
    } catch (error: unknown) {
      console.error("Bridge error:", error);
      let errorMsg = error instanceof Error ? error.message : "Bridge failed";
      
      if (errorMsg.includes("User rejected") || errorMsg.includes("User denied")) {
        errorMsg = "Transaction cancelled by user";
      } else if (errorMsg.includes("insufficient funds")) {
        errorMsg = "Insufficient funds for gas or USDC amount";
      } else if (errorMsg.includes("chain") || errorMsg.includes("network")) {
        errorMsg = `Network error. Please ensure you're on ${fromChain} testnet and try again.`;
      } else if (errorMsg.includes("Arc")) {
        errorMsg = "Arc Testnet may not be supported by Bridge Kit yet. Try using Circle Faucet or manual CCTP.";
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
    },
    reset,
    isOnSepolia: chainId === SEPOLIA_CHAIN_ID,
    isOnArc: chainId === ARC_CHAIN_ID,
    currentChainId: chainId,
  };
}
