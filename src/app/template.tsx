"use client";

import { motion, useReducedMotion } from "motion/react";

/** Transição suave entre páginas (fade + slide leve). */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.3, 0.7, 0.4, 1] }}
    >
      {children}
    </motion.div>
  );
}
