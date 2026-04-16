// ═══════════════════════════════════════════════════════════
// PageTransition — Animated Route Wrapper (Motion)
// ═══════════════════════════════════════════════════════════
// Wraps each page with a smooth fade+slide animation.
// Uses the Motion library (formerly Framer Motion).
// ═══════════════════════════════════════════════════════════

"use client";

import { motion } from "motion/react";

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}     // Start invisible + shifted down
      animate={{ opacity: 1, y: 0 }}      // Animate to visible + normal position
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
