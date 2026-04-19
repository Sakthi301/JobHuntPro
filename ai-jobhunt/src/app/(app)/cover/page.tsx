// ═══════════════════════════════════════════════════════════
// Cover Notes Page — AI Generator (Freemium)
// ═══════════════════════════════════════════════════════════
// Features:
// - Responsive grid (2-col → 1-col on mobile)
// - Sonner toasts for feedback
// - Motion animations on cards and buttons
// - AutoAnimate on saved notes list
// - Free users: 5 total uses (shared), then upgrade prompt
// ═══════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CoverNote, Profile } from "@/types";
import { motion, AnimatePresence } from "motion/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { toast } from "sonner";

export default function CoverPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState<CoverNote[]>([]);
  const [customJD, setCustomJD] = useState("");
  const [coldCo, setColdCo] = useState("");
  const [coldRole, setColdRole] = useState("");
  const [output, setOutput] = useState("");
  const [outputTitle, setOutputTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [notesRef] = useAutoAnimate();

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);
      const { data: n } = await supabase.from("cover_notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setNotes(n || []);
    }
    load();
  }, []);

  // --- Generate via API ---
  const generate = async (type: string) => {
    if (!profile) { toast.error("Complete your profile first!"); return; }
    setLoading(true);
    toast.loading("✍️ AI is writing...", { id: "cover" });

    try {
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          company: type === "cold_email" ? coldCo : "Company",
          title: type === "cold_email" ? coldRole : "Role",
          jd: type === "custom" ? customJD : "",
          profile
        })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(data.note);
        setOutputTitle(type === "cold_email" ? `Cold Email → ${coldCo}` : "Custom Cover Note");
        // Refresh profile to update usage count
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: updated } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          setProfile(updated);
        }
        toast.success("Generated! ✅", { id: "cover" });
      } else if (data.error === "limit_reached") {
        toast.error("You've used all 5 free uses! Upgrade to continue. 🔒", { id: "cover" });
        window.dispatchEvent(new CustomEvent("show-pricing"));
      } else {
        toast.error("Error: " + data.error, { id: "cover" });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: "cover" });
    } finally {
      setLoading(false);
    }
  };

  // --- Save note ---
  const saveNote = async () => {
    if (!profile || !output) return;
    const { error } = await supabase.from("cover_notes").insert({
      user_id: profile.id, company: outputTitle,
      role: "AI Generated", note: output,
      note_date: new Date().toDateString()
    });
    if (!error) {
      toast.success("Saved to database! 💾");
      const { data: n } = await supabase.from("cover_notes").select("*").eq("user_id", profile.id).order("created_at", { ascending: false });
      setNotes(n || []);
    }
  };

  const isPro = profile?.plan && profile.plan !== "free";
  const usesLeft = Math.max(0, 5 - (profile?.usage_count || 0));

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>

      {/* Header */}
      <h2 className="page-title">✍️ Cover Notes</h2>
      <p className="page-subtitle" style={{ marginBottom: "8px" }}>
        AI-generated cover notes and cold emails tailored to your profile
      </p>

      {/* Free tier uses-left badge */}
      {!isPro && profile && (
        <div style={{ marginBottom: "24px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "5px 14px", borderRadius: "20px",
            background: usesLeft > 0 ? "rgba(0,217,170,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${usesLeft > 0 ? "rgba(0,217,170,0.3)" : "rgba(239,68,68,0.3)"}`,
            fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-heading)",
            color: usesLeft > 0 ? "var(--teal)" : "var(--red)",
            textTransform: "uppercase", letterSpacing: "1.5px",
          }}>
            {usesLeft > 0 ? `${usesLeft} free uses left` : "Free uses exhausted — Upgrade to continue"}
          </span>
        </div>
      )}
      {isPro && (
        <div style={{ marginBottom: "24px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "5px 14px", borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(212,168,67,0.12), rgba(245,215,110,0.06))",
            border: "1px solid rgba(212,168,67,0.25)",
            fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-heading)",
            color: "var(--pro-gold2)", textTransform: "uppercase", letterSpacing: "1.5px",
          }}>
            👑 Pro — Unlimited
          </span>
        </div>
      )}

      {/* ─── Generator Cards ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px", marginBottom: "24px" }}>

        {/* Custom Cover Note */}
        <motion.div className="glass-card" style={{ padding: "24px" }}
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h4 style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>📋 Custom Cover Note</h4>
          <p style={{ fontSize: "12px", color: "var(--sub)", lineHeight: 1.7, marginBottom: "14px" }}>Paste a job description for a tailored note.</p>
          <label className="label">Job Description</label>
          <textarea className="input" value={customJD} onChange={(e) => setCustomJD(e.target.value)}
            style={{ minHeight: "100px", resize: "vertical", marginBottom: "14px" }}
            placeholder="Paste full job description here..." />
          <motion.button disabled={loading} onClick={() => generate("custom")}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ width: "100%", padding: "11px", background: "rgba(255,107,53,.1)", border: "1px solid rgba(255,107,53,.3)", color: "var(--ember)", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Writing..." : "Generate Cover Note"}
          </motion.button>
        </motion.div>

        {/* Cold Email */}
        <motion.div className="glass-card" style={{ padding: "24px" }}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h4 style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>📧 Cold Email to HR</h4>
          <p style={{ fontSize: "12px", color: "var(--sub)", lineHeight: 1.7, marginBottom: "14px" }}>Direct cold email to a recruiter.</p>
          <label className="label">Target Company</label>
          <input className="input" value={coldCo} onChange={(e) => setColdCo(e.target.value)}
            style={{ marginBottom: "14px" }} placeholder="e.g. Google" />
          <label className="label">Role</label>
          <input className="input" value={coldRole} onChange={(e) => setColdRole(e.target.value)}
            style={{ marginBottom: "14px" }} placeholder="e.g. Software Engineer" />
          <motion.button disabled={loading} onClick={() => generate("cold_email")}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ width: "100%", padding: "11px", background: "rgba(0,217,170,.1)", border: "1px solid rgba(0,217,170,.3)", color: "var(--teal)", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Writing..." : "Generate Cold Email"}
          </motion.button>
        </motion.div>
      </div>

      {/* ─── AI Output ─── */}
      <AnimatePresence>
        {output && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card"
            style={{ padding: "28px", marginBottom: "24px" }}
          >
            <div className="section-label" style={{ marginBottom: "14px" }}>{outputTitle}</div>
            <pre style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.85 }}>
              {output}
            </pre>
            <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => { navigator.clipboard.writeText(output); toast.success("Copied! 📋"); }}
                style={{ padding: "10px 18px", borderRadius: "9px", fontSize: "12px", border: "1px solid rgba(245,200,66,.3)", color: "var(--gold)", background: "transparent", cursor: "pointer" }}>
                📋 Copy
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={saveNote}
                style={{ padding: "10px 18px", borderRadius: "9px", fontSize: "12px", border: "1px solid var(--border2)", color: "var(--sub)", background: "transparent", cursor: "pointer" }}>
                💾 Save
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setOutput("")}
                style={{ padding: "10px 18px", borderRadius: "9px", fontSize: "12px", border: "1px solid var(--border2)", color: "var(--sub)", background: "transparent", cursor: "pointer" }}>
                ✕ Close
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Saved Notes ─── */}
      {notes.length > 0 && (
        <>
          <h3 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--text)" }}>💾 Saved Notes</h3>
          <div ref={notesRef}>
            {notes.map(n => (
              <motion.div key={n.id} className="glass-card" style={{ padding: "20px", marginBottom: "12px" }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ember)" }}>{n.company}</div>
                    <div style={{ fontSize: "12px", color: "var(--sub)" }}>{n.role}</div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--muted)" }}>{n.note_date}</div>
                </div>
                <div style={{ fontSize: "12px", color: "var(--sub)", lineHeight: 1.7, background: "var(--code-bg)", padding: "14px", borderRadius: "8px", whiteSpace: "pre-wrap" }}>
                  {n.note}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
