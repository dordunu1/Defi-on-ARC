import React from 'react';
import { RefreshCw, Shield, Zap } from './Icons';

export const Features = () => {
  return (
    <section className="relative z-20 py-24 bg-white">
      <div className="container mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            The Gateway to Arc Testnet
          </h2>
          <p className="text-gray-500 text-lg">
            IsoDex isn't just a DEX. It's the primary bridge connecting Sepolia to the high-performance Arc Testnet ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {/* Feature 1 */}
          <div className="group p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 border border-gray-100 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-7 h-7 text-dex-accent" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Seamless Bridging</h3>
            <p className="text-gray-500 leading-relaxed">
              Transfer ETH and stablecoins from Sepolia to Arc Testnet in seconds. Our bidirectional bridge ensures liquidity flows freely between layers.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 border border-gray-100 group-hover:scale-110 transition-transform">
              <Zap className="w-7 h-7 text-dex-accent" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Finality</h3>
            <p className="text-gray-500 leading-relaxed">
              Experience the speed of Arc. Trades on IsoDex execute instantly with negligible gas fees, making high-frequency strategies possible.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all duration-300">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 border border-gray-100 group-hover:scale-110 transition-transform">
              <Shield className="w-7 h-7 text-dex-accent" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Uniswap V2 Security</h3>
            <p className="text-gray-500 leading-relaxed">
              Built on the battle-tested Uniswap V2 AMM architecture. Simple, reliable, and permissionless trading for all your testnet assets.
            </p>
          </div>
        </div>

        {/* CTA Box */}
        <div className="mt-20 rounded-[3rem] bg-gradient-to-br from-dex-accent to-orange-500 p-12 text-center relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-3xl font-bold text-white mb-6">Ready to start trading?</h3>
                <p className="text-orange-100 mb-8 max-w-xl mx-auto text-lg">
                    Get your testnet tokens and start exploring the IsoDex ecosystem today. No waitlist, no hidden fees.
                </p>
                <button className="bg-white text-dex-accent font-bold py-4 px-10 rounded-full shadow-xl hover:shadow-2xl hover:bg-gray-50 transition-all transform hover:-translate-y-1">
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