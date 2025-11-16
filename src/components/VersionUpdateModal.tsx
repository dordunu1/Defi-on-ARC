import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

interface VersionUpdateModalProps {
  isOpen: boolean;
  onRefresh: () => void;
  onDismiss?: () => void;
}

export default function VersionUpdateModal({ isOpen, onRefresh, onDismiss }: VersionUpdateModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
              {/* Close button (optional - only if onDismiss is provided) */}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
              </div>

              {/* Content */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  New Version Available
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">
                  A new version of the app is available. Please refresh to get the latest features and improvements.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-center">
                <button
                  onClick={onRefresh}
                  className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Refresh Now
                </button>
              </div>

              {/* Auto-refresh countdown */}
              <p className="text-xs text-gray-500 text-center mt-4">
                The page will refresh automatically in 10 seconds...
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

