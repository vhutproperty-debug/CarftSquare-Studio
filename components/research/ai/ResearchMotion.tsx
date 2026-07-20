'use client';

import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

export const researchEase = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.35, ease: researchEase },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.28, ease: researchEase },
};

export function ResearchFadeUp({
  children,
  className,
  delay = 0,
  ...rest
}: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: researchEase, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function ResearchMessageMotion({
  children,
  fromUser,
}: {
  children: ReactNode;
  fromUser?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: researchEase }}
      className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`}
    >
      {children}
    </motion.div>
  );
}

export function ResearchLivePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.3, ease: researchEase }}
    >
      {children}
    </motion.div>
  );
}

export { motion, AnimatePresence };
