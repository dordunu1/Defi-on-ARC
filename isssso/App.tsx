import React from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Features } from './components/Features';

function App() {
  return (
    <div className="min-h-screen bg-dex-bg text-dex-text selection:bg-orange-200 selection:text-orange-900">
      <Header />
      <main>
        <Hero />
        <Features />
      </main>
      
      <footer className="w-full py-12 text-center bg-white border-t border-gray-100 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 md:mb-0 flex items-center space-x-2">
               <span className="font-semibold text-gray-900">IsoDex Protocol</span>
               <span>© 2024</span>
            </div>
            <div className="flex space-x-8">
               <a href="#" className="hover:text-dex-accent transition-colors">Documentation</a>
               <a href="#" className="hover:text-dex-accent transition-colors">GitHub</a>
               <a href="#" className="hover:text-dex-accent transition-colors">Discord</a>
               <a href="#" className="hover:text-dex-accent transition-colors">Twitter</a>
            </div>
        </div>
      </footer>
    </div>
  );
}

export default App;