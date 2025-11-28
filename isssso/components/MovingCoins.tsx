import React from 'react';
import { USDC, USDT, DAI, ETH } from './Icons';

interface CoinProps {
  type: 'USDC' | 'USDT' | 'DAI' | 'ETH';
  delay: string;
  lane: number;
}

const Coin = ({ type, delay, lane }: CoinProps) => {
  const Icon = {
    USDC: USDC,
    USDT: USDT,
    DAI: DAI,
    ETH: ETH
  }[type];

  // Lane offset calculations for isometric spacing
  const laneOffset = {
    1: 'left-[10%] top-[10%]', 
    2: 'left-[30%] top-[30%]',
    3: 'left-[50%] top-[50%]',
  }[lane];

  return (
    <div 
      className={`absolute w-16 h-16 opacity-100 ${laneOffset} animate-stream-slide`}
      style={{ animationDelay: delay }}
    >
      <div className="w-full h-full transform -rotate-[45deg] shadow-[10px_10px_20px_rgba(0,0,0,0.1)] rounded-full bg-white/80 backdrop-blur-sm border border-white/40 p-1">
         <div className="w-full h-full rounded-full bg-white/40 flex items-center justify-center">
            <Icon className="w-10 h-10" />
         </div>
      </div>
    </div>
  );
};

export const MovingCoins = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Isometric Grid Container */}
      <div className="relative w-[200%] h-[200%] -left-[50%] -top-[50%] iso-container opacity-60">
        
        {/* Grid Lines - Darker for light mode */}
        <div className="absolute inset-0" 
             style={{ 
               backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), 
               linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)`,
               backgroundSize: '100px 100px'
             }}>
        </div>

        {/* Lane 1: USDC Stream */}
        <Coin type="USDC" delay="0s" lane={1} />
        <Coin type="USDC" delay="2s" lane={1} />
        <Coin type="USDC" delay="4s" lane={1} />
        <Coin type="USDC" delay="6s" lane={1} />
        <Coin type="USDC" delay="8s" lane={1} />

        {/* Lane 2: USDT Stream */}
        <Coin type="USDT" delay="1s" lane={2} />
        <Coin type="USDT" delay="3s" lane={2} />
        <Coin type="USDT" delay="5s" lane={2} />
        <Coin type="USDT" delay="7s" lane={2} />
        <Coin type="USDT" delay="9s" lane={2} />
        
        {/* Lane 3: DAI/ETH Stream */}
        <Coin type="DAI" delay="0.5s" lane={3} />
        <Coin type="ETH" delay="2.5s" lane={3} />
        <Coin type="DAI" delay="4.5s" lane={3} />
        <Coin type="ETH" delay="6.5s" lane={3} />

      </div>
      
      {/* Bottom Fade Gradient - Light Mode */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-dex-bg to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};