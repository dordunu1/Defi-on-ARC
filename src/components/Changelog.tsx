import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Bell } from 'lucide-react';
import '../styles/neumorphic.css';

interface ChangelogEntry {
  date: string;
  version?: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2025-11-13',
    version: 'v2.0.0',
    changes: [
      'Switched Pools page to use Supabase data instead of RPC calls - 87% reduction in RPC calls',
      'Added KITTY and DOGG tokens to default token list',
      'Fixed TVL calculation to match indexer values',
      'Improved token logo handling for custom tokens',
      'Added proper routing with React Router - tabs now persist on refresh',
    ],
  },
  {
    date: '2025-11-12',
    version: 'v1.9.0',
    changes: [
      'Implemented multi-hop swaps via Router contract',
      'Added swap route display in approval modal',
      'Enhanced token selector with ERC20 address paste functionality',
      'Added DiceBear logos for custom tokens',
      'Fixed price chart display for multi-hop pools',
    ],
  },
  {
    date: '2025-11-11',
    version: 'v1.8.0',
    changes: [
      'Added SwapActivity component showing recent swaps',
      'Improved pagination with consistent table height',
      'Optimized ActivityTab to use Supabase sender_address',
      'Fixed volume and fees calculation in Pools section',
      'Added auto-refresh every 5 minutes for pool metrics',
    ],
  },
];

interface ChangelogProps {
  docsOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const NeumorphicToggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <label className="neumorphic-toggle" style={{ cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      style={{ display: 'none' }}
    />
    <span className={`toggle-slider ${checked ? 'on' : ''}`}></span>
  </label>
);

export default function Changelog({ docsOpen = false, onOpenChange }: ChangelogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set([0])); // First entry expanded by default
  const [hasUnreadChanges, setHasUnreadChanges] = useState(true);

  // Check if user has seen the latest changelog
  useEffect(() => {
    const lastSeenDate = localStorage.getItem('changelog_last_seen');
    if (lastSeenDate === CHANGELOG[0].date) {
      setHasUnreadChanges(false);
    }
  }, []);

  const toggleEntry = (index: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEntries(newExpanded);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnreadChanges(false);
    localStorage.setItem('changelog_last_seen', CHANGELOG[0].date);
    onOpenChange?.(true);
  };

  const handleClose = () => {
    if (!isClosing) {
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
        onOpenChange?.(false);
      }, 1000);
    }
  };

  return (
    <>
      {/* Notification Bubble */}
      {!isOpen && !docsOpen && (
        <motion.button
          onClick={handleOpen}
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 bg-orange-500 text-white rounded-full p-2.5 sm:p-3 md:p-4 shadow-2xl hover:bg-orange-600 transition-all flex items-center gap-1.5 sm:gap-2 group"
          initial={{ scale: 0 }}
          animate={{ 
            scale: 1,
            opacity: hasUnreadChanges ? [1, 0.7, 1] : 1
          }}
          transition={{
            opacity: hasUnreadChanges ? {
              repeat: Infinity,
              duration: 1.5,
              ease: "easeInOut"
            } : {}
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          {hasUnreadChanges && (
            <motion.span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
          <span className="hidden sm:inline text-xs sm:text-sm font-semibold whitespace-nowrap">What's New</span>
        </motion.button>
      )}

      {/* Changelog Modal */}
      <AnimatePresence>
        {(isOpen || isClosing) && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: isClosing ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              onClick={handleClose}
            />

            {/* Modal */}
            <motion.div
              className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto sm:w-full sm:max-w-md max-h-[85vh] sm:max-h-[80vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ 
                opacity: isClosing ? 0 : 1, 
                y: isClosing ? 30 : 0, 
                scale: isClosing ? 0.95 : 1 
              }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 sm:p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold truncate">Changelog</h2>
                  <p className="text-xs sm:text-sm text-orange-100 truncate">Latest updates and improvements</p>
                </div>
                <div className="ml-3 flex-shrink-0">
                  <NeumorphicToggle
                    checked={isOpen && !isClosing}
                    onChange={(checked) => {
                      if (!checked && isOpen) {
                        handleClose();
                      } else if (checked && !isOpen) {
                        setIsOpen(true);
                        setIsClosing(false);
                        onOpenChange?.(true);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2 sm:space-y-3">
                {CHANGELOG.map((entry, index) => {
                  const isExpanded = expandedEntries.has(index);
                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Entry Header */}
                      <button
                        onClick={() => toggleEntry(index)}
                        className="w-full p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors gap-2"
                      >
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm sm:text-base">
                            {entry.version && <span className="text-orange-600 mr-1 sm:mr-2">{entry.version}</span>}
                            <span className="whitespace-nowrap">
                              {new Date(entry.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>

                      {/* Entry Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 sm:p-4 bg-white">
                              <ul className="space-y-1.5 sm:space-y-2">
                                {entry.changes.map((change, changeIndex) => (
                                  <li key={changeIndex} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700">
                                    <span className="text-orange-500 mt-0.5 sm:mt-1 flex-shrink-0">•</span>
                                    <span className="break-words">{change}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

