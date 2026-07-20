'use client';

import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import '@/styles/research/workspace.css';

/**
 * Calm research loading state — no empty grey skeleton blocks.
 */
export default function ResearchLoadingState({
  label = 'Preparing your research workspace…',
}: {
  label?: string;
}) {
  return (
    <div className="research-workspace flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <motion.div
        className="research-loading-orb mb-5 flex items-center justify-center text-white"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Loader2 className="h-6 w-6 animate-spin" />
      </motion.div>
      <motion.p
        className="text-sm font-medium text-slate-700 dark:text-slate-200"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
      >
        {label}
      </motion.p>
      <motion.div
        className="research-progress-track mt-5 w-44"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="research-progress-bar w-2/3" />
      </motion.div>
    </div>
  );
}
