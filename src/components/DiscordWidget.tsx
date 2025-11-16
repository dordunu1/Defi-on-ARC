import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const DISCORD_SERVER_ID = import.meta.env.VITE_DISCORD_SERVER_ID || '';
const DISCORD_INVITE_LINK = import.meta.env.VITE_DISCORD_INVITE_LINK || 'https://discord.com/invite/AVpBqqMH';

export default function DiscordWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if Discord server ID is not configured
  if (!DISCORD_SERVER_ID) {
    return null;
  }

  return (
    <>
      {/* Discord FAB Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-16 right-4 sm:bottom-6 sm:right-60 md:right-72 z-40 bg-indigo-600 text-white rounded-full p-2.5 sm:p-3 md:p-4 shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-1.5 sm:gap-2 group"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <img 
          src="/discord.png" 
          alt="Discord" 
          className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 object-contain"
        />
        <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
          Join Discord
        </span>
      </motion.button>

      {/* Discord Widget Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Join Our Discord</h2>
                    <p className="text-sm text-indigo-100 mt-1">
                      Connect with the community
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-indigo-500 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Discord Widget */}
                <div className="p-4">
                  <iframe
                    src={`https://discord.com/widget?id=${DISCORD_SERVER_ID}&theme=dark`}
                    width="100%"
                    height="500"
                    allowTransparency={true}
                    frameBorder="0"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                    className="rounded-lg"
                    style={{ minHeight: '500px' }}
                  />
                </div>

                {/* Footer with direct invite link */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <a
                    href={DISCORD_INVITE_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Open in Discord App
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

