
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Loader2, CheckCircle2, AlertCircle, ExternalLink, ChevronDown, Clock, ArrowLeftRight, ArrowDown, ArrowDownUp } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import confetti from 'canvas-confetti';
import { useBridge, type BridgeToken, CHAIN_TOKENS, SEPOLIA_CHAIN_ID, ARC_CHAIN_ID } from '../hooks/useBridge';
import { ARC_RPC_URLS } from '../config/wagmi';

interface BridgeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  asPage?: boolean;
}

export type BridgeDirection = 'sepolia-to-arc' | 'arc-to-sepolia';

const BRIDGE_MAINTENANCE_MODE = import.meta.env.VITE_BRIDGE_MAINTENANCE_MODE === 'true';

export default function BridgeModal({ isOpen = true, onClose, asPage = false }: BridgeModalProps) {
  const { address, isConnected, chainId } = useAccount();

  const [amount, setAmount] = useState('');
  const selectedToken: BridgeToken = 'USDC';
  const [direction, setDirection] = useState<BridgeDirection>('sepolia-to-arc');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [bridgeStartTime, setBridgeStartTime] = useState<number | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(true);

  const {
    state,
    bridge,
    reset,
    isOnSepolia,
    isOnArc,
    currentChainId,
  } = useBridge();

  const publicClient = usePublicClient();

  useEffect(() => {
    if (asPage && currentChainId && state.status !== 'success' && !state.direction) {
      if (currentChainId === ARC_CHAIN_ID) {
        setDirection('arc-to-sepolia');
      } else if (currentChainId === SEPOLIA_CHAIN_ID) {
        setDirection('sepolia-to-arc');
      }
    } else if (isOpen && currentChainId && state.status !== 'success' && !state.direction) {
      if (currentChainId === ARC_CHAIN_ID) {
        setDirection('arc-to-sepolia');
      } else if (currentChainId === SEPOLIA_CHAIN_ID) {
        setDirection('sepolia-to-arc');
      }
    }
  }, [isOpen, asPage, currentChainId, state.status, state.direction]);

  const activeDirection = state.direction || direction;
  const sourceChainId = activeDirection === 'sepolia-to-arc' ? SEPOLIA_CHAIN_ID : ARC_CHAIN_ID;
  const destinationChainId = activeDirection === 'sepolia-to-arc' ? ARC_CHAIN_ID : SEPOLIA_CHAIN_ID;
  const sourceChainName = activeDirection === 'sepolia-to-arc' ? 'Sepolia' : 'Arc Testnet';
  const destinationChainName = activeDirection === 'sepolia-to-arc' ? 'Arc Testnet' : 'Sepolia';

  const sourceTokenInfo = CHAIN_TOKENS[sourceChainId]?.[selectedToken];
  const destinationTokenInfo = CHAIN_TOKENS[destinationChainId]?.[selectedToken];

  const ERC20_ABI = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
  ] as const;

  const { data: sourceBalanceRaw, isLoading: isLoadingSourceBalance } = useReadContract({
    address: (sourceTokenInfo?.contractAddress && isConnected && address && currentChainId === sourceChainId) ? sourceTokenInfo.contractAddress as Address : undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && !!sourceTokenInfo && currentChainId === sourceChainId,
      refetchInterval: 5000,
    },
  });

  const sourcePublicClient = useMemo(() => {
    if (currentChainId === sourceChainId || !sourceTokenInfo) return null;

    if (sourceChainId === SEPOLIA_CHAIN_ID) {
      return createPublicClient({
        chain: sepolia,
        transport: http('https://ethereum-sepolia-rpc.publicnode.com', {
          retryCount: 2,
          timeout: 8000,
        }),
      });
    } else if (sourceChainId === ARC_CHAIN_ID) {
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
            default: { http: ARC_RPC_URLS },
            public: { http: ARC_RPC_URLS },
          },
          blockExplorers: {
            default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
          },
        },
        transport: http(ARC_RPC_URLS[0], {
          retryCount: 2,
          timeout: 8000,
        }),
      });
    }
    return null;
  }, [sourceChainId, sourceTokenInfo, currentChainId]);

  const [sourceBalanceManual, setSourceBalanceManual] = useState<string>('0');
  const [isLoadingSourceBalanceManual, setIsLoadingSourceBalanceManual] = useState(false);

  useEffect(() => {
    if (currentChainId === sourceChainId || !sourcePublicClient || !address || !sourceTokenInfo) {
      setSourceBalanceManual('0');
      return;
    }

    let isCancelled = false;
    setIsLoadingSourceBalanceManual(true);

    const fetchSourceBalance = async () => {
      try {
        const balance = await sourcePublicClient.readContract({
          address: sourceTokenInfo.contractAddress as Address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });

        if (!isCancelled) {
          const formatted = formatUnits(balance as bigint, sourceTokenInfo.decimals);
          setSourceBalanceManual(formatted);
        }
      } catch (err) {
        console.error('Error fetching source balance:', err);
        if (!isCancelled) {
          setSourceBalanceManual('0');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSourceBalanceManual(false);
        }
      }
    };

    fetchSourceBalance();
    const interval = setInterval(fetchSourceBalance, 30000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [sourcePublicClient, address, sourceTokenInfo, currentChainId, sourceChainId]);

  const destinationPublicClient = useMemo(() => {
    if (!destinationTokenInfo) return null;

    if (destinationChainId === SEPOLIA_CHAIN_ID) {
      return createPublicClient({
        chain: sepolia,
        transport: http('https://ethereum-sepolia-rpc.publicnode.com', {
          retryCount: 2,
          timeout: 8000,
        }),
      });
    } else if (destinationChainId === ARC_CHAIN_ID) {
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
            default: { http: ARC_RPC_URLS },
            public: { http: ARC_RPC_URLS },
          },
          blockExplorers: {
            default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
          },
        },
        transport: http(ARC_RPC_URLS[0], {
          retryCount: 2,
          timeout: 8000,
        }),
      });
    }
    return null;
  }, [destinationChainId, destinationTokenInfo]);

  const [destinationBalance, setDestinationBalance] = useState<string>('0');
  const [isLoadingDestinationBalance, setIsLoadingDestinationBalance] = useState(false);

  useEffect(() => {
    if (!destinationPublicClient || !address || !destinationTokenInfo) {
      setDestinationBalance('0');
      return;
    }

    let isCancelled = false;
    setIsLoadingDestinationBalance(true);

    const fetchDestinationBalance = async () => {
      try {
        const balance = await destinationPublicClient.readContract({
          address: destinationTokenInfo.contractAddress as Address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });

        if (!isCancelled) {
          const formatted = formatUnits(balance as bigint, destinationTokenInfo.decimals);
          setDestinationBalance(formatted);
        }
      } catch (err) {
        console.error('Error fetching destination balance:', err);
        if (!isCancelled) {
          setDestinationBalance('0');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDestinationBalance(false);
        }
      }
    };

    fetchDestinationBalance();
    const interval = setInterval(fetchDestinationBalance, 30000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [destinationPublicClient, address, destinationTokenInfo]);

  const tokenBalance = useMemo(() => {
    if (currentChainId === sourceChainId) {
      if (!sourceBalanceRaw || !sourceTokenInfo) return '0';
      return formatUnits(sourceBalanceRaw as bigint, sourceTokenInfo.decimals);
    } else {
      return sourceBalanceManual;
    }
  }, [currentChainId, sourceChainId, sourceBalanceRaw, sourceTokenInfo, sourceBalanceManual]);

  const isLoadingBalance = currentChainId === sourceChainId ? isLoadingSourceBalance : isLoadingSourceBalanceManual;
  const balanceError = '';

  useEffect(() => {
    if (!isOpen && !asPage) {
      setAmount('');
      reset();
    }
  }, [isOpen, asPage, reset]);

  useEffect(() => {
    if (state.status === 'bridging') {
      setShowProgressModal(true);
    }
  }, [state.status]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (state.isLoading) {
      if (!bridgeStartTime) {
        setBridgeStartTime(Date.now());
        setElapsedTime(0);
      }

      interval = setInterval(() => {
        if (bridgeStartTime) {
          const elapsed = Math.floor((Date.now() - bridgeStartTime) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    } else {
      setElapsedTime(0);
      setBridgeStartTime(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isLoading, bridgeStartTime]);

  useEffect(() => {
    if (
      state.status === 'success' &&
      state.currentStep === 4 &&
      state.receiveTxHash &&
      !state.error &&
      !state.isLoading
    ) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: NodeJS.Timeout = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [state.status, state.currentStep, state.receiveTxHash, state.error, state.isLoading]);

  const handleBridge = async () => {
    await bridge(selectedToken, amount, direction);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    reset();
    setAmount('');
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen && !asPage) return null;

  if (BRIDGE_MAINTENANCE_MODE) {
    return (
      <div className={`${asPage ? 'w-full max-w-2xl mx-auto px-4' : ''}`}>
        <motion.div
          className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/30 relative overflow-hidden"
          style={{
            boxShadow: `
              inset 0 1px 0 rgba(255, 255, 255, 0.9),
              inset 0 -1px 0 rgba(0, 0, 0, 0.05),
              0 0 30px rgba(251, 146, 60, 0.15),
              0 0 60px rgba(251, 146, 60, 0.1),
              0 10px 30px rgba(0, 0, 0, 0.1)
            `
          }}
          initial={asPage ? { opacity: 0, y: 20 } : { opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Bridge Under Maintenance</h2>
            <p className="text-gray-600 text-base sm:text-lg mb-2">
              We'll resume bridge operations soon.
            </p>
            <p className="text-sm text-gray-500">
              Updates will be shared when available.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const content = (
    <div className={`${asPage ? 'w-full max-w-2xl mx-auto px-4' : ''}`}>
      <motion.div
        className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/30 overflow-hidden"
        style={{
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(0, 0, 0, 0.05),
            0 0 30px rgba(251, 146, 60, 0.15),
            0 0 60px rgba(251, 146, 60, 0.1),
            0 10px 30px rgba(0, 0, 0, 0.1),
            0 4px 8px rgba(0, 0, 0, 0.05)
          `
        }}
        initial={asPage ? { opacity: 0, y: 20 } : { opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Close Button */}
        {!asPage && (
          <motion.button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-5 h-5" />
          </motion.button>
        )}

        {/* Header */}
        <motion.h3
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6"
        >
          Bridge Tokens
        </motion.h3>

        {/* Content */}
        <div className="relative z-10">
          {(state.status === 'idle' || (state.status === 'bridging' && !showProgressModal)) && (
            <div className="space-y-4">
              {/* Bridge in Progress Indicator */}
              {state.status === 'bridging' && !showProgressModal && (
                <div className="bg-orange-50/80 backdrop-blur-sm border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                    <div>
                      <p className="font-semibold text-orange-900">Bridge in Progress</p>
                      <p className="text-xs text-orange-700">Step {state.currentStep} of 4</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProgressModal(true)}
                    className="text-sm text-orange-600 hover:text-orange-800 font-medium underline"
                  >
                    View Progress
                  </button>
                </div>
              )}

              {/* Source Chain */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
                style={{
                  boxShadow: `
                    inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                    inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                    0 4px 8px rgba(0, 0, 0, 0.05)
                  `,
                }}
              >
                <p className="text-xs text-gray-500 mb-2">From</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={sourceChainId === SEPOLIA_CHAIN_ID ? "/sepolia.png" : "/Arc.png"}
                      alt={sourceChainName}
                      className="w-8 h-8"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div>
                      <p className="font-bold text-gray-900">{sourceChainName}</p>
                      <p className="text-xs text-gray-500">Chain ID: {sourceChainId}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Bridge Arrow with Swap Button */}
              <div className="flex items-center justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    setDirection(direction === 'sepolia-to-arc' ? 'arc-to-sepolia' : 'sepolia-to-arc');
                  }}
                  disabled={state.isLoading}
                  className="p-3 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    boxShadow: `
                      inset 0 2px 4px rgba(255, 255, 255, 0.5),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                      0 0 20px rgba(251, 146, 60, 0.3),
                      0 4px 12px rgba(251, 146, 60, 0.4)
                    `,
                  }}
                  title="Swap chains"
                >
                  <ArrowDownUp className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Destination Chain */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
                style={{
                  boxShadow: `
                    inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                    inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                    0 4px 8px rgba(0, 0, 0, 0.05)
                  `,
                }}
              >
                <p className="text-xs text-gray-500 mb-2">To</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={destinationChainId === SEPOLIA_CHAIN_ID ? "/sepolia.png" : "/Arc.png"}
                      alt={destinationChainName}
                      className="w-8 h-8"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div>
                      <p className="font-bold text-gray-900">{destinationChainName}</p>
                      <p className="text-xs text-gray-500">Chain ID: {destinationChainId}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Token & Amount */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
                style={{
                  boxShadow: `
                    inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                    inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                    0 4px 8px rgba(0, 0, 0, 0.05)
                  `,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Amount</label>
                  {isConnected && address && (
                    <span className="text-xs text-gray-500">
                      Balance: {isLoadingBalance ? '...' : parseFloat(tokenBalance).toFixed(2)} USDC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <img src="/usdc.svg" alt="USDC" className="w-8 h-8" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }} />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
                    disabled={state.isLoading}
                  />
                </div>
              </motion.div>

              {/* Warnings */}
              {isConnected && chainId !== sourceChainId && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-50/80 backdrop-blur-sm border border-yellow-200 rounded-xl p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Auto-switch to {sourceChainName}</p>
                      <p className="text-xs mt-1">
                        Bridge Kit will automatically switch your network to {sourceChainName}.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {!isConnected && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50/80 backdrop-blur-sm border border-blue-200 rounded-xl p-4 text-center"
                >
                  <p className="text-sm text-blue-800">
                    Please connect your wallet to bridge tokens
                  </p>
                </motion.div>
              )}

              {/* Bridge Button */}
              <motion.button
                onClick={handleBridge}
                disabled={!isConnected || !amount || parseFloat(amount) <= 0 || state.isLoading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${!isConnected || !amount || parseFloat(amount) <= 0 || state.isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                  }`}
                style={!isConnected || !amount || parseFloat(amount) <= 0 || state.isLoading ? {} : {
                  boxShadow: `
                    inset 0 2px 4px rgba(255, 255, 255, 0.3),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(251, 146, 60, 0.4),
                    0 2px 4px rgba(0, 0, 0, 0.1)
                  `,
                }}
                whileHover={!isConnected || !amount || parseFloat(amount) <= 0 || state.isLoading ? {} : { scale: 1.02 }}
                whileTap={!isConnected || !amount || parseFloat(amount) <= 0 || state.isLoading ? {} : { scale: 0.98 }}
              >
                {state.isLoading ? 'Processing...' : `Bridge ${selectedToken}`}
              </motion.button>
            </div>
          )}

          {/* Success */}
          {state.status === 'success' && state.currentStep === 4 && state.receiveTxHash && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-orange-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 mb-2">Bridge Successful!</p>
                <p className="text-sm text-gray-600 mb-4">
                  Your {selectedToken} has been successfully transferred from {sourceChainName} to {destinationChainName}.
                </p>

                <div className="space-y-2 mb-4">
                  {state.sourceTxHash && (
                    <a
                      href={
                        sourceChainId === SEPOLIA_CHAIN_ID
                          ? `https://sepolia.etherscan.io/tx/${state.sourceTxHash}`
                          : `https://testnet.arcscan.app/tx/${state.sourceTxHash}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-orange-600 hover:text-orange-700 text-sm"
                    >
                      <span>View {sourceChainName} Transaction</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {state.receiveTxHash && (
                    <a
                      href={
                        destinationChainId === SEPOLIA_CHAIN_ID
                          ? `https://sepolia.etherscan.io/tx/${state.receiveTxHash}`
                          : `https://testnet.arcscan.app/tx/${state.receiveTxHash}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-orange-600 hover:text-orange-700 text-sm block"
                    >
                      <span>View Receive Transaction</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              <motion.button
                onClick={handleClose}
                className="mt-4 w-full px-8 py-3 bg-orange-500 text-white rounded-xl font-semibold text-lg hover:bg-orange-600 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 mb-2">Bridge Failed</p>
                <div className="text-sm text-red-600 mb-4 max-h-40 overflow-y-auto text-left bg-red-50 p-3 rounded-lg">
                  <p className="whitespace-pre-wrap break-words">{state.error}</p>
                </div>
                <motion.button
                  onClick={() => {
                    reset();
                    setAmount('');
                  }}
                  className="w-full px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold text-lg transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Again
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Progress Modal */}
      <AnimatePresence>
        {state.status === 'bridging' && showProgressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/30 overflow-hidden"
              style={{
                boxShadow: `
                  inset 0 1px 0 rgba(255, 255, 255, 0.9),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                  0 0 30px rgba(251, 146, 60, 0.15),
                  0 0 60px rgba(251, 146, 60, 0.1),
                  0 10px 30px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <button
                onClick={() => setShowProgressModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">
                Bridge Progress
              </h3>

              <div className="space-y-4">
                {[
                  { step: 1, title: 'Approve USDC', desc: 'Allow contract to spend tokens' },
                  { step: 2, title: 'Burn on source', desc: 'Burn tokens on source chain' },
                  { step: 3, title: 'Attestation', desc: 'Fetch attestation from Circle API' },
                  { step: 4, title: `Mint on ${destinationChainName}`, desc: 'Mint tokens on destination' },
                ].map((item, idx) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="bg-white/60 backdrop-blur-lg rounded-2xl p-4 border border-white/40"
                    style={{
                      boxShadow: `
                        inset 2px 2px 4px rgba(255, 255, 255, 0.8),
                        inset -2px -2px 4px rgba(0, 0, 0, 0.1),
                        0 4px 8px rgba(0, 0, 0, 0.05)
                      `,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0">
                        {state.currentStep >= item.step ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center"
                            style={{
                              boxShadow: `
                                inset 0 2px 4px rgba(255, 255, 255, 0.5),
                                inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                                0 0 20px rgba(251, 146, 60, 0.4)
                              `,
                            }}
                          >
                            <CheckCircle2 className="w-6 h-6 text-white" />
                          </motion.div>
                        ) : state.currentStep === item.step - 1 ? (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"
                            style={{
                              boxShadow: `
                                inset 0 2px 4px rgba(255, 255, 255, 0.5),
                                inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                                0 4px 12px rgba(251, 146, 60, 0.4)
                              `,
                            }}
                          >
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300"
                            style={{
                              boxShadow: `
                                inset 0 2px 4px rgba(255, 255, 255, 0.9),
                                inset 0 -2px 4px rgba(0, 0, 0, 0.1)
                              `,
                            }}
                          >
                            <div className="w-6 h-6 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${state.currentStep >= item.step ? 'text-orange-600' : state.currentStep === item.step - 1 ? 'text-orange-600' : 'text-gray-500'}`}>
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {state.currentStep >= item.step ? 'Completed' : state.currentStep === item.step - 1 ? 'Processing...' : item.desc}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <div className="mt-4 p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white text-center font-semibold"
                  style={{
                    boxShadow: `
                      inset 0 2px 4px rgba(255, 255, 255, 0.3),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                      0 4px 12px rgba(251, 146, 60, 0.4)
                    `,
                  }}
                >
                  Bridging...
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (asPage) {
    return content;
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </motion.div>
  );
}

