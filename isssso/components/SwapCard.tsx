import React, { useState } from 'react';
import { Settings, ChevronDown, ArrowDown, ETH, USDC } from './Icons';

export const SwapCard = () => {
  const [sellAmount, setSellAmount] = useState('1.0');
  const [buyAmount, setBuyAmount] = useState('2850.54');

  return (
    <div className="relative w-full max-w-[420px] mx-auto z-20 perspective-card">
      {/* Glow Effect - Orange/Warm */}
      <div className="absolute -inset-2 bg-gradient-to-r from-orange-400 to-yellow-300 rounded-[2rem] blur-xl opacity-20 animate-pulse"></div>
      
      {/* Card Content - Light Mode */}
      <div className="relative bg-white border border-gray-100 rounded-3xl p-4 shadow-2xl">
        
        {/* Header - Simple V2 Style */}
        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-gray-900 font-semibold text-lg">Swap</span>
          <button className="text-gray-400 hover:text-gray-600 transition-colors hover:rotate-90 duration-300">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Sell Input Panel */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors">
          <div className="flex justify-between items-center mb-1">
             <span className="text-gray-500 text-sm">You pay</span>
          </div>
          <div className="flex justify-between items-center h-12">
            <input 
              type="number" 
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="bg-transparent text-4xl text-gray-900 font-medium outline-none w-2/3 placeholder-gray-300"
              placeholder="0"
            />
            <button className="flex items-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-full py-1.5 pl-2 pr-3 transition-all">
               <ETH className="w-6 h-6" />
               <span className="text-lg font-semibold text-gray-900">ETH</span>
               <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-3">
             <span className="text-gray-400 text-xs">Balance: 4.20 ETH</span>
             <span className="text-gray-400 text-xs">~$2,850.54</span>
          </div>
        </div>

        {/* Swap Arrow - Clean V2 */}
        <div className="relative h-2 z-10">
           <div className="absolute left-1/2 -translate-x-1/2 -top-4 bg-white border-4 border-gray-50 rounded-xl p-2 cursor-pointer hover:scale-110 transition-transform shadow-sm">
              <ArrowDown className="w-4 h-4 text-gray-600" />
           </div>
        </div>

        {/* Buy Input Panel */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors mt-2">
          <div className="flex justify-between items-center mb-1">
             <span className="text-gray-500 text-sm">You receive</span>
          </div>
          <div className="flex justify-between items-center h-12">
            <input 
              type="number" 
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="bg-transparent text-4xl text-gray-900 font-medium outline-none w-2/3 placeholder-gray-300"
              placeholder="0"
            />
            <button className="flex items-center space-x-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-full py-1.5 pl-2 pr-3 transition-all">
               <USDC className="w-6 h-6" />
               <span className="text-lg font-semibold text-gray-900">USDC</span>
               <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-3">
             <span className="text-gray-400 text-xs">Balance: 0.00 USDC</span>
             <span className="text-gray-400 text-xs">~$2,850.54</span>
          </div>
        </div>

        {/* Rate Info */}
        <div className="mt-4 px-2 flex justify-between items-center text-xs text-dex-accent font-medium cursor-pointer hover:opacity-80">
            <div className="flex items-center">
                <span className="bg-orange-100 p-1 rounded mr-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-dex-accent">
                        <path d="M12 20V10"/>
                        <path d="M18 20V4"/>
                        <path d="M6 20v-4"/>
                    </svg>
                </span>
                <span>1 ETH = 2,850.54 USDC</span>
            </div>
            <div className="flex items-center text-gray-400">
                <span className="mr-1">$4.21 Gas</span>
                <ChevronDown className="w-3 h-3" />
            </div>
        </div>

        {/* Swap Button */}
        <button className="w-full mt-4 bg-dex-accent hover:bg-dex-accentHover text-white text-xl font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 transform hover:scale-[1.01] active:scale-[0.99]">
          Swap
        </button>

      </div>
    </div>
  );
};