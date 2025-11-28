import React from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenDocs: () => void;
}

export default function LandingPage({ onGetStarted, onOpenDocs }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-dex-bg text-dex-text selection:bg-orange-200 selection:text-orange-900">
      <LandingHeader />
      <main>
        <LandingHero onGetStarted={onGetStarted} onOpenDocs={onOpenDocs} />
        <LandingFeatures onGetStarted={onGetStarted} />
      </main>
      
      <footer className="w-full py-12 text-center bg-white border-t border-gray-100 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 md:mb-0 flex items-center space-x-2">
               <span className="font-semibold text-gray-900">DeFi On ARC</span>
               <span>© 2025</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
