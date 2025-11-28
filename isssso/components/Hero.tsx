import React from 'react';
import { MovingCoins } from './MovingCoins';
import { SwapCard } from './SwapCard';
import { ArrowRight } from './Icons';

export const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
      
      {/* Background Animated Scene */}
      <MovingCoins />

      {/* Main Content Container */}
      <div className="relative z-10 container mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24">
        
        {/* Left Side: Copywriting */}
        <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 mb-2">
             <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-dex-accent"></span>
             </span>
             <span className="text-sm font-semibold text-dex-accent">Live on Arc Testnet</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-gray-900">
            Bridge & Swap <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-dex-accent to-yellow-500">
              Sepolia to Arc
            </span>
          </h1>
          
          <p className="text-gray-500 text-lg lg:text-xl leading-relaxed max-w-lg mx-auto lg:mx-0 font-medium">
            The professional V2 DEX and Bridge. Seamlessly move assets from Sepolia to Arc Testnet with zero slippage and instant finality.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="group w-full sm:w-auto px-8 py-4 rounded-full bg-dex-accent text-white font-bold text-lg hover:bg-dex-accentHover transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center space-x-2">
              <span>Launch Bridge</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-gray-700 font-semibold text-lg border border-gray-200 hover:border-orange-200 hover:bg-orange-50 transition-colors shadow-sm">
              Read Documentation
            </button>
          </div>

          <div className="pt-8 flex items-center justify-center lg:justify-start space-x-8 text-gray-400">
             <div className="flex flex-col">
                <span className="text-gray-900 text-2xl font-bold">$420M+</span>
                <span className="text-sm font-medium">Bridged Volume</span>
             </div>
             <div className="w-px h-10 bg-gray-200"></div>
             <div className="flex flex-col">
                <span className="text-gray-900 text-2xl font-bold">~2s</span>
                <span className="text-sm font-medium">Finality</span>
             </div>
             <div className="w-px h-10 bg-gray-200"></div>
             <div className="flex flex-col">
                <span className="text-gray-900 text-2xl font-bold">0%</span>
                <span className="text-sm font-medium">Bridge Fee</span>
             </div>
          </div>
        </div>

        {/* Right Side: The Isometric Swap Card visual */}
        <div className="flex-1 w-full max-w-md lg:max-w-xl perspective-[2000px]">
           {/* We add a slight 3D rotation to the container of the card to make it sit 'in' the world */}
           <div className="transform transition-transform duration-500 hover:rotate-x-2 hover:rotate-y-2 lg:rotate-y-[-10deg] lg:rotate-x-[5deg]">
              <SwapCard />
              {/* Decorative floating elements behind card */}
              <div className="absolute -z-10 top-10 -right-10 w-24 h-24 bg-orange-400 rounded-2xl rotate-12 blur-xl opacity-40 animate-float"></div>
              <div className="absolute -z-10 -bottom-5 -left-5 w-32 h-32 bg-yellow-400 rounded-full blur-2xl opacity-30"></div>
           </div>
        </div>

      </div>
      
      {/* Decorative gradient glowing blobs - Warm tones */}
      <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] bg-orange-200/40 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[10%] left-[5%] w-[600px] h-[600px] bg-yellow-100/60 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
    </section>
  );
};