import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config/wagmi';
import BridgeModal from './components/BridgeModal';
import LandingPage from './components/LandingPage';
import Navigation from './components/Navigation';
import Swap from './components/Swap';
import Pools from './components/Pools';
import CreatePool from './components/CreatePool';
import MaintenancePage from './components/MaintenancePage';
import XFollowFAB from './components/XFollowFAB';
import DiscordWidget from './components/DiscordWidget';
import ChangelogDocsWrapper from './components/ChangelogDocsWrapper';
import { Home } from 'lucide-react';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

// MAINTENANCE MODE: Controlled by environment variable VITE_MAINTENANCE_MODE
// Set to "true" in .env to enable maintenance page, "false" or omit to go live
const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

function AppContent() {
  // Show maintenance page if maintenance mode is enabled
  if (MAINTENANCE_MODE) {
    return <MaintenancePage />;
  }

  const { address, isConnected } = useAccount();
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're on the landing page route
  const isLandingPage = location.pathname === '/';

  return (
    <>
      {isLandingPage ? (
        <LandingPage onGetStarted={() => navigate('/bridge')} />
      ) : (
        <div className="min-h-screen bg-orange-50 flex items-start justify-center p-3 sm:p-4 md:p-8">
          <div className="w-full max-w-5xl mt-4 sm:mt-6 md:mt-8">
            {/* Header with Wallet Connect */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                  title="Back to Home"
                >
                  <Home className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700 hidden sm:inline">Home</span>
                </button>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    DeFi On ARC
                  </h1>
                  <p className="text-gray-600 text-xs md:text-sm">
                    Bridge, Swap, and Manage Liquidity
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-2 border border-gray-200 shadow-lg self-start md:self-auto">
              <ConnectButton
                showBalance={true}
                chainStatus="icon"
                accountStatus={{
                  smallScreen: 'avatar',
                  largeScreen: 'full',
                }}
              />
              </div>
            </div>

            {/* Navigation Tabs */}
            <Navigation />

            {/* Content Area */}
            <Routes>
              <Route path="/bridge" element={<BridgeModal asPage={true} />} />
              <Route path="/swap" element={<Swap />} />
              <Route path="/pools" element={<Pools />} />
              <Route path="/create-pool" element={<CreatePool />} />
              <Route path="*" element={<Navigate to="/bridge" replace />} />
            </Routes>
          </div>

          <BridgeModal
            isOpen={isBridgeModalOpen}
            onClose={() => setIsBridgeModalOpen(false)}
          />

          {/* Social Links */}
          <DiscordWidget />
          <XFollowFAB />
          
          {/* Changelog and Docs */}
          <ChangelogDocsWrapper />
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

