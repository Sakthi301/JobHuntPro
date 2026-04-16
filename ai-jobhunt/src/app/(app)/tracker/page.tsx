// ═══════════════════════════════════════════════════════════
// Tracker Page — Application Management (Responsive)
// ═══════════════════════════════════════════════════════════
// Features:
// - Responsive table with horizontal scroll on mobile
// - AutoAnimate for smooth row deletion
// - Sonner toasts for feedback
// - Motion hover effects on action buttons
// ═══════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Application } from "@/types";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import CountUp from "react-countup";

export default function TrackerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [bodyRef] = useAutoAnimate();

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setApps(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (!error) {
      setApps(apps.map(a => a.id === id ? { ...a, status } : a));
      toast.success(`Status → ${status}`);
    }
  };

  const deleteApp = async (id: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (!error) {
      setApps(apps.filter(a => a.id !== id));
      toast.success("Application removed");
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
      <div className="skeleton" style={{ width: "100%", maxWidth: "900px", height: "300px" }}></div>
    </div>;
  }

  // Status badge color mapping
  const statusColor = (s: string) => {
    switch (s) {
      case "interview": return "var(--blue)";
      case "offer": return "var(--teal)";
      case "rejected": return "var(--red)";
      default: return "var(--gold)";
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

      {/* Header + Stats */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", marginBottom: "20px" }}>
        <div>
          <h2 className="page-title">📋 Application Tracker</h2>
          <p className="page-subtitle">Every application safely stored in the cloud</p>
        </div>
        <div className="stat-card" style={{ padding: "14px 20px" }}>
          <span style={{ fontSize: "10px", color: "var(--sub)", textTransform: "uppercase" }}>Total: </span>
          <span style={{ fontSize: "24px", fontWeight: 800, fontFamily: "var(--font-heading)" }}>
            <CountUp end={apps.length} duration={1} />
          </span>
        </div>
      </div>

      {/* ─── Mobile Cards View (≤768px) ─── */}
      <div className="tracker-cards" ref={bodyRef}>
        {apps.length === 0 ? (
          <div className="glass-card" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
            No applications yet. Scan for jobs first!
          </div>
        ) : apps.map((app) => (
          <motion.div key={app.id} className="glass-card"
            style={{ padding: "18px", marginBottom: "12px" }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{app.company}</div>
                <div style={{ color: "var(--sub)", fontSize: "13px" }}>{app.title}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-heading)", color: (app.score || 0) >= 75 ? "var(--teal)" : "var(--gold)" }}>
                  {app.score || "—"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--muted)" }}>
                {app.applied_date || "—"}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 600, color: statusColor(app.status), background: `${statusColor(app.status)}15`, border: `1px solid ${statusColor(app.status)}40` }}>
                {app.status.toUpperCase()}
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={app.status} onChange={e => updateStatus(app.id, e.target.value)}
                className="input" style={{ flex: 1, padding: "8px 10px", minWidth: "120px" }}>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => deleteApp(app.id)}
                style={{ padding: "8px 14px", background: "rgba(255,71,87,.1)", border: "none", color: "var(--red)", cursor: "pointer", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                Delete
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
