import { motion } from 'framer-motion';
import { Twitter } from 'lucide-react';

export default function XFollowFAB() {
  return (
    <motion.a
      href="https://x.com/realchriswilder"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 bg-orange-500 text-white rounded-full p-2.5 sm:p-3 md:p-4 shadow-2xl hover:bg-orange-600 transition-all flex items-center gap-1.5 sm:gap-2 group"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <Twitter className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
        Follow me on X for updates
      </span>
    </motion.a>
  );
}
