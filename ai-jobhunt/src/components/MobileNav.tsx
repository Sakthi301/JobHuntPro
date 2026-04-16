// ═══════════════════════════════════════════════════════════
// MobileNav — Bottom Tab Bar (Responsive, Motion-animated)
// ═══════════════════════════════════════════════════════════
// Fixed bottom navigation for mobile screens (≤768px).
// Uses Motion for tap animations on each icon.
// ═══════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Search, BarChart2, CheckSquare, FileText } from "lucide-react";
import { motion } from "motion/react";

const NAV_ITEMS = [
  { name: "Setup",     path: "/setup",     icon: Settings },
  { name: "Hunt",      path: "/",          icon: Search },
  { name: "Analytics", path: "/analytics", icon: BarChart2 },
  { name: "Tracker",   path: "/tracker",   icon: CheckSquare },
  { name: "Cover",     path: "/cover",     icon: FileText },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="mobile-nav" style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "var(--navbar-bg)", backdropFilter: "blur(24px)",
      borderTop: "1px solid var(--border)",
      padding: "6px 0 env(safe-area-inset-bottom, 12px)",
      zIndex: 100, transition: "background 0.3s"
    }}>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileTap={{ scale: 0.85 }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  fontSize: "9px", padding: "6px 12px",
                  color: isActive ? "var(--ember)" : "var(--muted)",
                  transition: "color .2s"
                }}
              >
                <Icon size={20} />
                <span style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.name}</span>
                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="mobile-indicator"
                    style={{
                      width: "4px", height: "4px", borderRadius: "50%",
                      background: "var(--ember)", marginTop: "1px"
                    }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Only show on mobile */}
      <style dangerouslySetInnerHTML={{ __html: `
        .mobile-nav { display: none; }
        @media (max-width: 768px) { .mobile-nav { display: block !important; } }
      `}} />
    </div>
  );
}
