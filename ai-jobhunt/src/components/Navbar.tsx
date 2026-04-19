// ═══════════════════════════════════════════════════════════
// Navbar — Desktop Navigation with Premium Pro Theme
// ═══════════════════════════════════════════════════════════
// Features:
// - Dynamic brand: "SkillScan" (free) → "SkillScan PRO" (pro)
// - Gold-tinted premium chrome for Pro users
// - All tabs visible for all users (freemium model)
// - Gold avatar ring for Pro users
// - Tab navigation with active indicator
// - Dark/Light mode toggle
// ═══════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Settings, Search, BarChart2, CheckSquare, FileText, LogOut, Sun, Moon, Crown, MessageSquare, FileSearch, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "motion/react";

// Navigation items
const NAV_ITEMS = [
  { name: "Setup",     path: "/setup",     icon: Settings },
  { name: "Match",     path: "/",          icon: Search },
  { name: "Analytics", path: "/analytics", icon: BarChart2 },
  { name: "Tracker",   path: "/tracker",   icon: CheckSquare },
  { name: "Cover",     path: "/cover",     icon: FileText },
  { name: "Interview", path: "/interview", icon: MessageSquare },
  { name: "ATS Score", path: "/ats",       icon: FileSearch },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState("");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Load cached plan instantly to prevent free→pro flash on refresh
  const [userPlan, setUserPlan] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("userPlan") || "free";
    }
    return "free";
  });

  const isPro = userPlan !== "free";

  // Wait for hydration before showing theme toggle
  useEffect(() => setMounted(true), []);

  // Fetch user name on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      } else {
        setUserName(user?.email?.split("@")[0] || "User");
      }
      // Fetch plan and cache it
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
        if (profile?.plan) {
          setUserPlan(profile.plan);
          localStorage.setItem("userPlan", profile.plan);
        }
      }
    };
    getUser();
  }, []);

  // Sign out — clear cached plan
  const handleLogout = async () => {
    localStorage.removeItem("userPlan");
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav
      className={isPro ? "navbar-pro" : ""}
      style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: "62px",
        background: "var(--navbar-bg)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.3s, border-color 0.3s"
      }}>

      {/* ─── Brand Logo ─── */}
      <Link href="/" style={{ textDecoration: 'none' }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <motion.img
            src="/logo.svg"
            alt="SkillScan Logo"
            whileHover={{ rotate: 10, scale: 1.1 }}
            style={{
              width: "36px", height: "36px", flexShrink: 0,
              ...(isPro ? { filter: "drop-shadow(0 0 8px rgba(212,168,67,0.4))" } : {})
            }}
          />
          <div style={{ display: "flex", alignItems: "baseline", gap: "0px" }}>
            <div
              className={isPro ? "pro-brand-text" : ""}
              style={{
                fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 800,
                ...(!isPro ? {
                  background: "linear-gradient(90deg, #FF7A18 0%, #FFC837 40%, #4FACFE 70%, #007BFF 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                } : {})
              }}
            >SkillScan</div>
            {isPro && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 800,
                  background: "linear-gradient(135deg, #D4A843, #F5D76E)",
                  color: "#1a1200",
                  padding: "2px 7px", borderRadius: "6px",
                  marginLeft: "4px", letterSpacing: "0.3px",
                  boxShadow: "0 0 12px rgba(212,168,67,0.3)",
                }}
              >PRO</motion.span>
            )}
          </div>
        </div>
      </Link>

      {/* ─── Desktop Tab Links ─── */}
      <div className="nav-tabs" style={{ display: "flex", gap: "2px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          // Pro users get gold active states everywhere
          const activeColor = isPro ? "var(--pro-gold1)" : "var(--ember)";
          const activeBg = isPro ? "rgba(212,168,67,0.08)" : "rgba(255, 107, 53, 0.1)";
          const activeBorder = isPro ? "rgba(212,168,67,0.2)" : "rgba(255, 107, 53, 0.2)";
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  padding: "8px 14px", borderRadius: "9px",
                  fontSize: "13px", fontWeight: 500,
                  color: isActive ? activeColor : "var(--sub)",
                  background: isActive ? activeBg : "transparent",
                  border: isActive ? `1px solid ${activeBorder}` : "1px solid transparent",
                  transition: "all .2s"
                }}
              >
                <Icon size={15} /> {item.name}
              </motion.div>
            </Link>
          );
        })}

      </div>

      {/* ─── Right Section: Plan Badge + Theme Toggle + User ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

        {/* Plan Badge */}
        {isPro ? (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="pro-badge-glow"
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 14px", borderRadius: "8px",
              background: "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(245,215,110,0.08))",
              border: "1px solid rgba(212,168,67,0.35)",
              fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-heading)",
              color: "var(--pro-gold2)", textTransform: "uppercase", letterSpacing: "0.5px",
            }}
          >
            <Crown size={13} /> PRO
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.dispatchEvent(new CustomEvent("show-pricing"))}
            style={{
              padding: "6px 14px", borderRadius: "8px",
              fontSize: "11px", fontWeight: 700,
              background: "linear-gradient(135deg, var(--ember), var(--ember2))",
              border: "none", color: "#fff", cursor: "pointer",
              fontFamily: "var(--font-heading)", letterSpacing: "0.3px",
            }}
          >
            ⚡ Upgrade
          </motion.button>
        )}

        {/* Theme Toggle Button */}
        {mounted && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "var(--glass)",
              border: isPro ? "1px solid var(--pro-border)" : "1px solid var(--border)",
              color: theme === "dark" ? (isPro ? "var(--pro-gold2)" : "var(--gold)") : "var(--blue)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </motion.button>
        )}

        {/* User Avatar + Name + Logout */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "5px 10px 5px 5px", borderRadius: "10px",
          background: "var(--glass)",
          border: isPro ? "1px solid var(--pro-border)" : "1px solid var(--border)"
        }}>
          <div
            className={isPro ? "pro-avatar-ring" : ""}
            style={{
              width: "30px", height: "30px", borderRadius: "8px",
              background: isPro
                ? "linear-gradient(135deg, #D4A843, #F5D76E)"
                : "linear-gradient(135deg, var(--ember), var(--ember2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-heading)", fontSize: "13px", fontWeight: 800,
              color: isPro ? "#1a1200" : "#fff"
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="user-name" style={{
            fontSize: "12px", color: "var(--sub)", fontWeight: 500,
            maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {userName}
          </div>

          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleLogout}
            title="Sign Out"
            style={{
              background: "none", border: "none", color: "var(--muted)",
              cursor: "pointer", padding: "4px", borderRadius: "6px",
              display: "flex", alignItems: "center"
            }}
          >
            <LogOut size={16} />
          </motion.button>
        </div>
      </div>

      {/* Responsive: hide desktop tabs + user name on mobile */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .nav-tabs { display: none !important; }
          .user-name { display: none !important; }
        }
      `}} />
    </nav>
  );
}
