import React from 'react';
import { ArrowLeftRight, RefreshCw, Droplets } from './Icons';

interface LandingFeaturesProps {
  onGetStarted: () => void;
}

export const LandingFeatures = ({ onGetStarted }: LandingFeaturesProps) => {
  return (
    <section className="relative z-20 py-24 bg-white">
      <div className="container mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            The Gateway to Arc Testnet
          </h2>
          <p className="text-gray-500 text-lg">
            DeFi On ARC isn't just a DEX. It's the primary bridge connecting Sepolia to the high-performance Arc Testnet ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {/* Feature 1: Cross-Chain Bridge */}
          <div className="group p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 border border-gray-100 group-hover:scale-110 transition-transform">
              <ArrowLeftRight className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Cross-Chain Bridge</h3>
            <p className="text-gray-500 leading-relaxed">
              Seamlessly bridge USDC between Ethereum Sepolia and Arc Testnet
            </p>
          </div>

          {/* Feature 2: Token Swap */}
          <div className="group p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 border border-gray-100 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Token Swap</h3>
            <p className="text-gray-500 leading-relaxed">
              Swap tokens on Arc Testnet with Uniswap V2 style interface
            </p>
          </div>

          {/* Feature 3: Liquidity Provision */}
          <div className="group p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 border border-gray-100 group-hover:scale-110 transition-transform">
              <Droplets className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Liquidity Provision</h3>
            <p className="text-gray-500 leading-relaxed">
              Add liquidity to pools on Arc Testnet and earn trading fees
            </p>
          </div>
        </div>

        {/* CTA Box */}
        <div className="mt-20 rounded-[3rem] bg-gradient-to-br from-orange-600 to-orange-500 p-12 text-center relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-3xl font-bold text-white mb-6">Ready to start trading?</h3>
                <p className="text-orange-100 mb-8 max-w-xl mx-auto text-lg">
                    Get your testnet tokens and start exploring the DeFi On ARC ecosystem today. No waitlist, no hidden fees.
                </p>
                <button 
                  onClick={onGetStarted}
                  className="bg-white/60 backdrop-blur-sm hover:bg-white/80 text-gray-800 font-bold py-4 px-10 rounded-xl border border-gray-200 transition-all transform hover:-translate-y-1"
                  style={{
                    boxShadow: `
                      inset 2px 2px 4px rgba(255, 255, 255, 0.9),
                      inset -2px -2px 4px rgba(0, 0, 0, 0.1)
                    `,
                  }}
                >
                    Enter App
                </button>
            </div>
            
            {/* Background patterns */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                 <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
                 <div className="absolute bottom-10 right-10 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
            </div>
        </div>

      </div>
    </section>
  );
};

