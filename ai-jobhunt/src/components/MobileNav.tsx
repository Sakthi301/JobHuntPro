// ═══════════════════════════════════════════════════════════
// MobileNav — Bottom Tab Bar with Premium Pro Theme
// ═══════════════════════════════════════════════════════════
// All tabs visible for all users (freemium model).
// Gold-tinted bottom bar for Pro users, gold active states.
// ═══════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Search, BarChart2, CheckSquare, FileText, MessageSquare, FileSearch, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { name: "Setup",     path: "/setup",     icon: Settings },
  { name: "Hunt",      path: "/",          icon: Search },
  { name: "Analytics", path: "/analytics", icon: BarChart2 },
  { name: "Tracker",   path: "/tracker",   icon: CheckSquare },
  { name: "Cover",     path: "/cover",     icon: FileText },
  { name: "Interview", path: "/interview", icon: MessageSquare },
  { name: "ATS",       path: "/ats",       icon: FileSearch },
];

export default function MobileNav() {
  const pathname = usePathname();
  // Load cached plan instantly to prevent free→pro flash
  const [userPlan, setUserPlan] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("userPlan") || "free";
    }
    return "free";
  });
  const supabase = createClient();

  const isPro = userPlan !== "free";

  useEffect(() => {
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
        if (data?.plan) {
          setUserPlan(data.plan);
          localStorage.setItem("userPlan", data.plan);
        }
      }
    }
    loadPlan();
  }, []);



  return (
    <div className={`mobile-nav ${isPro ? "mobile-nav-pro" : ""}`} style={{
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
          // Gold active color for all tabs if pro, or just for pro tabs
          const activeColor = isPro ? "var(--pro-gold2)" : "var(--ember)";
          const dotColor = isPro ? "var(--pro-gold1)" : "var(--ember)";

          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileTap={{ scale: 0.85 }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  fontSize: "9px", padding: "6px 12px",
                  color: isActive ? activeColor : "var(--muted)",
                  transition: "color .2s",
                  position: "relative",
                }}
              >
                <div style={{ position: "relative" }}>
                  <Icon size={20} />
                </div>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.name}</span>
                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="mobile-indicator"
                    style={{
                      width: "4px", height: "4px", borderRadius: "50%",
                      background: dotColor, marginTop: "1px",
                      boxShadow: isPro ? "0 0 8px rgba(212,168,67,0.4)" : "none",
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
