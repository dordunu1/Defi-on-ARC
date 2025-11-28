import React from 'react';
import { Logo } from './Icons';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export const LandingHeader = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-white/70 border-b border-gray-200">
      <div className="flex items-center space-x-2">
        <Logo className="w-10 h-10" />
        <span className="text-xl font-bold tracking-tight text-gray-900">DeFi On ARC</span>
      </div>

      <div className="flex items-center space-x-4">
        <div className="rounded-full">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
      </div>
    </nav>
  );
};

