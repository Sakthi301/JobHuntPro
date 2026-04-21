// ═══════════════════════════════════════════════════════════
// Dashboard Page — AI Profile Matcher (Fully Responsive)
// ═══════════════════════════════════════════════════════════
// Features:
// - Responsive grid (2-col → 1-col on mobile)
// - CountUp animated stat numbers
// - Lottie animation for empty state
// - Motion animated job cards with staggered entry
// - Sonner toasts for all feedback
// ═══════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobScanned, Profile } from "@/types";
import { Search, Loader2, Target, Filter, Crown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// Module-level cache to keep jobs alive when navigating between tabs
let cachedJobs: JobScanned[] = [];
let cachedUserId: string | null = null;

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    }),
  ]);
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobScanned[]>(cachedJobs);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    async function loadData() {
      try {
        const userResult = await withTimeout(supabase.auth.getUser(), 2000);
        const user = userResult.data.user;

        if (user) {
          if (cachedUserId !== user.id) {
            cachedJobs = [];
            cachedUserId = user.id;
            setJobs([]);
          }
          const profileResult = await withTimeout(
            supabase.from("profiles").select("*").eq("id", user.id).single(),
            2000
          );
          setProfile(profileResult.data);
        } else {
          cachedJobs = [];
          cachedUserId = null;
          setJobs([]);
        }
      } catch {
        cachedJobs = [];
        cachedUserId = null;
        setJobs([]);
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadData();
  }, [supabase]);

  // --- AI Job Scan ---
  const handleScan = async () => {
    if (
      !profile ||
      !profile.name ||
      !profile.experience ||
      !profile.current_role ||
      !profile.industry ||
      !profile.skills ||
      !profile.achievement ||
      !profile.min_salary ||
      !profile.target_roles || profile.target_roles.length === 0 ||
      !profile.target_locations || profile.target_locations.length === 0
    ) {
      toast.error("Please fill out ALL text fields and add locations/roles in Setup before scanning! 🛑");
      return;
    }

    setScanning(true); 
    cachedJobs = [];
    setJobs([]);
    toast.loading("🤖 AI is scanning opportunities...", { id: "scan" });

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, portals: ["LinkedIn", "Indeed"] })
      });
      const data = await res.json();
      if (data.success) {
        cachedJobs = data.jobs.sort((a: JobScanned, b: JobScanned) => b.score - a.score);
        setJobs(cachedJobs);
        toast.success(`Found ${data.jobs.length} matching opportunities! ✅`, { id: "scan" });
      } else if (data.error === "limit_reached") {
        // Free tier limit hit — show upgrade modal
        toast.error("You've used all 5 free uses! Upgrade to continue. 🔒", { id: "scan" });
        window.dispatchEvent(new CustomEvent("show-pricing"));
      } else {
        toast.error("Scan failed: " + data.error, { id: "scan" });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: "scan" });
    } finally {
      setScanning(false);
    }
  };

  // --- Mark job as applied ---
  const markApplied = async (job: JobScanned) => {
    if (!profile) return;
    const { error } = await supabase.from("applications").insert({
      user_id: profile.id, job_id: job.id, company: job.company,
      title: job.title, location: job.loc, score: job.score,
      portal: job.portal, salary: job.salary, job_url: job.url,
      status: "applied", applied_date: new Date().toDateString()
    });
    if (!error) toast.success(`Applied to ${job.company}! 🎯`);
    else toast.error("Failed to save");
  };

  if (loadingProfile) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
        <div className="skeleton" style={{ width: "100%", maxWidth: "900px", height: "300px" }}></div>
      </div>
    );
  }

  const isPro = profile?.plan && profile.plan !== "free";

  return (
    <div className={isPro ? "pro-page" : ""} style={{ maxWidth: "1300px", margin: "0 auto", position: "relative" }}>

      {/* Pro Aurora Background (only for pro users) */}
      {isPro && (
        <div className="pro-aurora">
          <div className="pro-aurora-blob pro-blob-1" />
          <div className="pro-aurora-blob pro-blob-2" />
          <div className="pro-aurora-blob pro-blob-3" />
        </div>
      )}

      {/* ─── Stats Row ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="stat-label">Profiles Scanned</div>
          <div className="stat-value">{jobs.length}</div>
          <div className="stat-hint">Latest batch</div>
        </motion.div>

        <motion.div className="stat-card" style={{ borderTop: "2px solid var(--teal)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="stat-label">Target Role</div>
          <div style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 800, margin: "8px 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {profile?.target_roles?.[0] || "Setup Needed"}
          </div>
          <div className="stat-hint">Primary focus</div>
        </motion.div>

        <motion.div className="stat-card" style={{ borderTop: "2px solid var(--blue)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="stat-label">Total Uses</div>
          <div className="stat-value">{profile?.usage_count || 0}</div>
          <div className="stat-hint">All features</div>
        </motion.div>

        <motion.div className="stat-card" style={{ borderTop: `2px solid ${profile?.plan && profile.plan !== 'free' ? 'var(--gold)' : 'var(--muted)'}` }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="stat-label">Current Plan</div>
          <div style={{ fontSize: "20px", fontFamily: "var(--font-heading)", fontWeight: 800, margin: "8px 0 4px", display: "flex", alignItems: "center", gap: "6px" }}>
            {profile?.plan && profile.plan !== 'free' ? (
              <><Crown size={18} style={{ color: "var(--gold)" }} /> {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}</>
            ) : (
              "Free"
            )}
          </div>
          <div className="stat-hint">
            {profile?.plan === 'free'
              ? `${Math.max(0, 5 - (profile?.usage_count || 0))} uses left`
              : "Unlimited access"}
          </div>
        </motion.div>
      </div>

      {/* ─── Main Grid: Controls + Job Cards ─── */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "18px", alignItems: "start" }}>

        {/* Left Panel — Scan Controls */}
        <motion.div className="glass-card" style={{ overflow: "hidden" }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={13} />
            <span className="section-label">Controls</span>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <motion.button onClick={handleScan} disabled={scanning} className="btn-primary"
              style={{ width: "100%", padding: "13px", fontSize: "13px" }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {scanning ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Scanning...</> : <><Search size={16} /> Scan & Match</>}
            </motion.button>

            <div style={{ marginTop: "12px", background: "var(--code-bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", minHeight: "100px", fontSize: "10px", fontFamily: "monospace", color: "var(--sub)" }}>
              {scanning
                ? "> 🤖 AI analyzing & scoring..."
                : `> Ready for ${profile?.target_roles?.[0] || "opportunities"}...`}
            </div>
          </div>
        </motion.div>

        {/* Right Panel — Job Cards */}
        <motion.div className="glass-card" style={{ overflow: "hidden" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Target size={13} />
            <span className="section-label" style={{ color: "var(--teal)" }}>AI-Matched Opportunities</span>
          </div>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Empty State */}
            {jobs.length === 0 && !scanning && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div
                  style={{
                    width: "120px",
                    height: "120px",
                    margin: "0 auto 16px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 30% 30%, rgba(79,172,254,.35), rgba(255,122,24,.2))",
                    border: "1px solid var(--border)",
                  }}
                >
                </div>
                <h4 style={{ fontSize: "20px", fontFamily: "var(--font-heading)", color: "var(--sub)", fontWeight: 700 }}>Ready to Match</h4>
                <p style={{ color: "var(--muted)", fontSize: "13px" }}>Click "Scan & Match" to find opportunities</p>
              </div>
            )}

            {/* Job Cards with Motion stagger */}
            <AnimatePresence>
              {jobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="glass-card"
                  style={{ padding: "20px" }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "9px", fontFamily: "monospace", color: "var(--sub)", textTransform: "uppercase" }}>{job.portal}</div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ember)", marginTop: "4px" }}>{job.company}</div>
                      <div style={{ fontSize: "16px", fontFamily: "var(--font-heading)", fontWeight: 700 }}>{job.title}</div>
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: "28px", fontFamily: "var(--font-heading)", fontWeight: 800, color: job.score >= 75 ? "var(--teal)" : job.score >= 55 ? "var(--gold)" : "var(--red)" }}>
                        {job.score}
                      </div>
                      <div style={{ fontSize: "8px", fontFamily: "monospace", color: "var(--sub)", textTransform: "uppercase" }}>% Match</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                    <span className="chip" style={{ background: "var(--glass)", border: "1px solid var(--border)", fontSize: "10px", fontFamily: "monospace", cursor: "default" }}>📍 {job.loc}</span>
                    <span className="chip" style={{ background: "var(--glass)", border: "1px solid var(--border)", fontSize: "10px", fontFamily: "monospace", cursor: "default" }}>💰 {job.salary}</span>
                  </div>

                  {/* AI Reason */}
                  <div style={{ fontSize: "13px", color: "var(--sub)", lineHeight: 1.65, padding: "10px 12px", background: "var(--code-bg)", borderRadius: "10px", borderLeft: "2px solid rgba(255,107,53,.35)", marginBottom: "12px" }}>
                    <strong>AI:</strong> {job.reasons}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => window.open(job.url, "_blank")}
                      style={{ padding: "9px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 700, background: "var(--ember)", border: "none", color: "#fff", cursor: "pointer" }}>
                      Apply Now
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => markApplied(job)}
                      style={{ padding: "9px 16px", borderRadius: "9px", fontSize: "12px", fontWeight: 500, background: "rgba(0,217,170,.06)", border: "1px solid rgba(0,217,170,.4)", color: "var(--teal)", cursor: "pointer" }}>
                      Mark Applied
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Responsive: stack dashboard grid on mobile */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}} />

    </div>
  );
}
