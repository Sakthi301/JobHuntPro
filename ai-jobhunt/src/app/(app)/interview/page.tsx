// ═══════════════════════════════════════════════════════════
// Interview Prep Page — PRO ONLY
// ═══════════════════════════════════════════════════════════
// Features:
// - Enter company + role → AI generates 10 interview Q&A
// - Collapsible accordion cards with staggered animations
// - Category badges (Technical, Behavioral, etc.)
// - Pro-gated with PricingModal fallback
// ═══════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { MessageSquare, Loader2, ChevronDown, ChevronUp, Lightbulb, Crown } from "lucide-react";
import PricingModal from "@/components/PricingModal";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

type Question = {
  id: number;
  category: string;
  question: string;
  ideal_answer: string;
  tip: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Technical: "var(--blue)",
  Behavioral: "var(--teal)",
  Situational: "var(--gold)",
  Company: "var(--ember)",
};

export default function InterviewPrepPage() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(data);
      }
    }
    load();
  }, []);

  const handleGenerate = async () => {
    if (!company.trim() || !role.trim()) {
      toast.error("Please enter both company and role! 🛑");
      return;
    }

    setLoading(true);
    setQuestions([]);
    toast.loading("🎯 AI is preparing your interview...", { id: "interview" });

    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role }),
      });
      const data = await res.json();

      if (data.success) {
        setQuestions(data.questions);
        toast.success(`Generated ${data.questions.length} interview questions! ✅`, { id: "interview" });
      } else if (data.error === "pro_required") {
        toast.error("This feature is for Pro users only! 👑", { id: "interview" });
        setShowPricing(true);
      } else {
        toast.error("Failed: " + data.error, { id: "interview" });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: "interview" });
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
    }
    setShowPricing(false);
  };

  return (
    <div className="pro-page" style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}>

      {/* Pro Aurora Background */}
      <div className="pro-aurora">
        <div className="pro-aurora-blob pro-blob-1" />
        <div className="pro-aurora-blob pro-blob-2" />
        <div className="pro-aurora-blob pro-blob-3" />
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <motion.div
            className="pro-badge-glow"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "5px 14px", borderRadius: "20px",
              background: "linear-gradient(135deg, rgba(212,168,67,0.12), rgba(245,215,110,0.06))",
              border: "1px solid rgba(212,168,67,0.25)",
              fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-heading)",
              color: "var(--pro-gold2)", textTransform: "uppercase", letterSpacing: "1.5px",
            }}
          >
            <Crown size={14} /> Pro Feature
          </motion.div>
        </div>
        <h2 className="page-title">
          AI Interview<br />
          <em className="pro-title-gradient" style={{ fontStyle: "normal" }}>Prep Coach</em>
        </h2>
        <p className="page-subtitle" style={{ maxWidth: "500px", margin: "8px auto 0" }}>
          Enter the company and role — AI generates 10 tailored interview questions with ideal answers.
        </p>
      </div>

      {/* Input Card */}
      <motion.div className="glass-card" style={{ padding: "24px", marginBottom: "20px" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="section-label" style={{ marginBottom: "16px" }}>TARGET INTERVIEW</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
          <div>
            <label className="label">Company Name</label>
            <input className="input" type="text" value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Google, TCS, Infosys" />
          </div>
          <div>
            <label className="label">Target Role</label>
            <input className="input" type="text" value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Software Engineer" />
          </div>
        </div>
        <motion.button
          onClick={handleGenerate}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary"
          style={{ width: "100%", padding: "14px", fontSize: "14px" }}
        >
          {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><MessageSquare size={16} /> Generate Interview Questions</>}
        </motion.button>
      </motion.div>

      {/* Questions List */}
      <AnimatePresence>
        {questions.map((q, i) => {
          const isOpen = expanded === q.id;
          const catColor = CATEGORY_COLORS[q.category] || "var(--sub)";
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: i * 0.06 }}
              className="glass-card"
              style={{ padding: "0", marginBottom: "12px", overflow: "hidden" }}
            >
              {/* Question Header (clickable) */}
              <div
                onClick={() => setExpanded(isOpen ? null : q.id)}
                style={{
                  padding: "18px 20px", cursor: "pointer",
                  display: "flex", alignItems: "flex-start", gap: "12px",
                  transition: "background 0.2s",
                }}
              >
                {/* Number */}
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                  background: `${catColor}15`, border: `1px solid ${catColor}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-heading)", fontSize: "13px", fontWeight: 800,
                  color: catColor,
                }}>
                  {q.id}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Category Badge */}
                  <span style={{
                    fontSize: "9px", fontWeight: 700, fontFamily: "monospace",
                    textTransform: "uppercase", letterSpacing: "0.5px",
                    color: catColor, marginBottom: "4px", display: "block",
                  }}>
                    {q.category}
                  </span>
                  {/* Question Text */}
                  <div style={{ fontSize: "14px", fontWeight: 600, lineHeight: 1.5, color: "var(--text)" }}>
                    {q.question}
                  </div>
                </div>

                {/* Expand Icon */}
                <div style={{ color: "var(--muted)", flexShrink: 0, marginTop: "4px" }}>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Answer Panel (collapsed by default) */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ padding: "0 20px 18px", borderTop: "1px solid var(--border)" }}>
                      {/* Ideal Answer */}
                      <div style={{
                        marginTop: "16px", padding: "14px 16px",
                        background: "var(--code-bg)", borderRadius: "10px",
                        borderLeft: "2px solid var(--teal)",
                        fontSize: "13px", lineHeight: 1.7, color: "var(--sub)",
                      }}>
                        <strong style={{ color: "var(--teal)" }}>Ideal Answer:</strong><br />
                        {q.ideal_answer}
                      </div>
                      {/* Tip */}
                      <div style={{
                        marginTop: "10px", display: "flex", alignItems: "flex-start", gap: "8px",
                        fontSize: "12px", color: "var(--gold)",
                      }}>
                        <Lightbulb size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span><strong>Tip:</strong> {q.tip}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        onSuccess={refreshProfile}
        userEmail={profile?.email || ""}
        userName={profile?.name || ""}
      />
    </div>
  );
}
