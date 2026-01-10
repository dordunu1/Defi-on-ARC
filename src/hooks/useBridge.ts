"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { EIP1193Provider, Chain } from "viem";

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
    bridgeKit.on("approve", (data: any) => {
      console.log("BridgeKit approve event - data:", data);
      setCurrentStep(1);
      if (data?.txHash) {
        console.log("Approve txHash from event:", data.txHash);
        setSourceTxHash(data.txHash);
      }
      // Don't save during approval - only save from burn onwards
    });
    bridgeKit.on("burn", (data: any) => {
      console.log("BridgeKit burn event:", data);
      setCurrentStep(2);
      if (data?.txHash) {
        setSourceTxHash(data.txHash);
      }
    });
    bridgeKit.on("fetchAttestation", (data: any) => {
      console.log("BridgeKit fetchAttestation event:", data);
      setCurrentStep(3);
    });
    bridgeKit.on("mint", (data: any) => {
      console.log("BridgeKit mint event:", data);
      setCurrentStep(4);
      if (data?.txHash) {
        setReceiveTxHash(data.txHash);
      }
      if (bridgeStatus === "bridging") {
        setBridgeStatus("success");
      }
    });
    setKit(bridgeKit);
  }, [bridgeStatus]);

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

      // Get Alchemy API key from environment
      const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || '';

      // Custom RPC URLs - use Alchemy if available, otherwise use public RPCs
      const SEPOLIA_RPC_URL = ALCHEMY_API_KEY
        ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : 'https://ethereum-sepolia-rpc.publicnode.com';

      const ARC_RPC_URL = ALCHEMY_API_KEY
        ? `https://arc-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : 'https://rpc.testnet.arc.network';

      // Create adapter with custom RPC endpoints
      const adapter = await createAdapterFromProvider({
        provider,
        getPublicClient: ({ chain }: { chain: Chain }) => {
          // Use custom RPC based on chain ID
          if (chain.id === SEPOLIA_CHAIN_ID) {
            return createPublicClient({
              chain: sepolia,
              transport: http(SEPOLIA_RPC_URL, {
                retryCount: 3,
                timeout: 10000,
              }),
            });
          } else if (chain.id === ARC_CHAIN_ID) {
            // Arc Testnet chain config
            return createPublicClient({
              chain: {
                id: ARC_CHAIN_ID,
                name: 'Arc Testnet',
                network: 'arc-testnet',
                nativeCurrency: {
                  decimals: 6,
                  name: 'USDC',
                  symbol: 'USDC',
                },
                rpcUrls: {
                  default: { http: [ARC_RPC_URL] },
                  public: { http: [ARC_RPC_URL] },
                },
                blockExplorers: {
                  default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
                },
              } as Chain,
              transport: http(ARC_RPC_URL, {
                retryCount: 3,
                timeout: 10000,
              }),
            });
          }
          // Fallback to default for other chains
          return createPublicClient({
            chain,
            transport: http(),
          });
        },
      });

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

      // Extract transaction hashes from result
      const resultAny = result as any;
      let extractedSourceTx: string | undefined;
      let extractedReceiveTx: string | undefined;

      console.log("Bridge result:", resultAny);
      console.log("Bridge result state:", resultAny?.state);
      console.log("Bridge result steps:", resultAny?.steps);

      // Check if result has error state
      if (resultAny?.state === 'error') {
        console.error("BridgeKit returned error state:", resultAny);
        const errorMsg = resultAny?.error?.message || "Bridge failed - check console for details";
        setError(errorMsg);
        setBridgeStatus("error");
        setCurrentStep(0);
        throw new Error(errorMsg);
      }

      if (resultAny?.steps) {
        resultAny.steps.forEach((step: any) => {
          console.log("Bridge step:", step.name, "txHash:", step.txHash, "state:", step.state);
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

      // Store result immediately so UI can access it
      setResult(result);

      // BridgeKit's bridge() should complete when all steps are done
      // If we already have the mint hash, we're done
      if (extractedReceiveTx) {
        setBridgeStatus("success");
        if (currentStep < 4) {
          setCurrentStep(4);
        }
        return result;
      }

      // If we don't have mint hash yet, check if bridge is still processing
      // Wait up to 3 minutes for completion (Sepolia can be slow)
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts * 3 seconds = 3 minutes

      while (attempts < maxAttempts && !extractedReceiveTx) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Re-check result steps in case they were populated asynchronously
        if (resultAny?.steps) {
          resultAny.steps.forEach((step: any) => {
            if (step.name === 'mint' && step.txHash) {
              extractedReceiveTx = step.txHash;
              setReceiveTxHash(step.txHash);
            }
          });
        }

        // If currentStep reached 4, give it a bit more time for hash to appear
        if (currentStep >= 4 && !extractedReceiveTx) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          // Final check
          if (resultAny?.steps) {
            resultAny.steps.forEach((step: any) => {
              if (step.name === 'mint' && step.txHash) {
                extractedReceiveTx = step.txHash;
                setReceiveTxHash(step.txHash);
              }
            });
          }
          break;
        }

        attempts++;
      }

      // If we got it, mark as success
      if (extractedReceiveTx) {
        setBridgeStatus("success");
        if (currentStep < 4) {
          setCurrentStep(4);
        }
        return result;
      }

      // If we still don't have it but reached step 4, mark as success anyway
      // (the mint event fired, so bridge completed even if hash not in result)
      if (currentStep >= 4) {
        setBridgeStatus("success");
        return result;
      }

      // If we still don't have it and didn't reach step 4, it's an error
      const errorMsg = "Bridge incomplete: Mint transaction was not completed. Your tokens may still be in transit.";
      setError(errorMsg);
      setBridgeStatus("error");
      setCurrentStep(0);
      throw new Error(errorMsg);
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
