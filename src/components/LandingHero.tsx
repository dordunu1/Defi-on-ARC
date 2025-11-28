import React from 'react';
import { MovingCoins } from './MovingCoins';
import { SwapCard } from './SwapCard';
import { ArrowRight } from './Icons';
import { usePoolMetrics } from '../hooks/usePoolMetrics';

interface LandingHeroProps {
  onGetStarted: () => void;
  onOpenDocs: () => void;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

export const LandingHero = ({ onGetStarted, onOpenDocs }: LandingHeroProps) => {
  const { totalTVL, totalVolume, isLoading } = usePoolMetrics();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
      
      {/* Background Animated Scene */}
      <MovingCoins />

      {/* Main Content Container */}
      <div className="relative z-10 container mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24">
        
        {/* Left Side: Copywriting */}
        <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl">
          <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-gray-900">
            Bridge & Swap <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-yellow-500">
              Sepolia to Arc
            </span>
          </h1>
          
          <p className="text-gray-500 text-lg lg:text-xl leading-relaxed max-w-lg mx-auto lg:mx-0 font-medium">
            The professional decentralized exchange and bridge. Seamlessly move assets from Sepolia to Arc Testnet with zero slippage and instant finality.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
            <button 
              onClick={onGetStarted}
              className="group w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-lg transition-all flex items-center justify-center space-x-2"
              style={{
                boxShadow: `
                  inset 0 2px 4px rgba(255, 255, 255, 0.3),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.2),
                  0 4px 12px rgba(251, 146, 60, 0.4),
                  0 2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              <span>Launch Bridge</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onOpenDocs}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/60 backdrop-blur-sm hover:bg-white/80 text-gray-800 font-semibold text-lg border border-gray-200 transition-all"
              style={{
                boxShadow: `
                  inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                  inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                `,
              }}
            >
              Read Documentation
            </button>
          </div>

          <div className="pt-8 flex items-center justify-center lg:justify-start space-x-8 text-gray-400">
             <div className="flex flex-col">
                <span className="text-gray-900 text-2xl font-bold">
                  {isLoading ? '...' : formatCurrency(totalTVL)}
                </span>
                <span className="text-sm font-medium">Total TVL</span>
             </div>
             <div className="w-px h-10 bg-gray-200"></div>
             <div className="flex flex-col">
                <span className="text-gray-900 text-2xl font-bold">
                  {isLoading ? '...' : formatCurrency(totalVolume)}
                </span>
                <span className="text-sm font-medium">Volume</span>
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

