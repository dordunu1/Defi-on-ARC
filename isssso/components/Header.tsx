import React from 'react';
import { Logo } from './Icons';

export const Header = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-white/70 border-b border-gray-200">
      <div className="flex items-center space-x-2">
        <Logo className="w-10 h-10" />
        <span className="text-xl font-bold tracking-tight text-gray-900">IsoDex</span>
      </div>

      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex items-center bg-gray-100 rounded-full px-4 py-1.5 space-x-2 border border-gray-200 shadow-sm">
           <div className="w-2 h-2 rounded-full bg-dex-accent animate-pulse"></div>
           <span className="text-xs font-semibold text-gray-700">Arc Testnet</span>
        </div>
        <button className="bg-dex-accent hover:bg-dex-accentHover text-white font-bold py-2.5 px-6 rounded-full text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-95">
          Connect Wallet
        </button>
      </div>
    </nav>
  );
};