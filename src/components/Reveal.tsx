"use client";

import { motion, useReducedMotion } from "motion/react";

/** Entrada suave ao montar/entrar na viewport (150–400ms, com propósito). */
export function Reveal({
  children,
  delay = 0,
  y = 10,
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-40px" }}
      transition={{ duration: 0.35, delay, ease: [0.3, 0.7, 0.4, 1] }}
    >
      {children}
    </motion.div>
  );
}
