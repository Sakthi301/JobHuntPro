// ═══════════════════════════════════════════════════════════
// ATS Resume Score Page — Freemium (5 free uses)
// ═══════════════════════════════════════════════════════════
// Features:
// - Upload resume + paste job description → AI scores compatibility
// - Circular score gauge with color coding
// - Matched & missing keyword tags
// - Section-by-section feedback cards
// - Improvement suggestions list
// - Free users get 5 uses, then upgrade prompt
// ═══════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { FileSearch, Loader2, Crown, Check, X, ArrowUpCircle, Upload } from "lucide-react";
import PricingModal from "@/components/PricingModal";
import { createClient } from "@/lib/supabase/client";

type ATSResult = {
  overall_score: number;
  keyword_match_percent: number;
  matched_keywords: string[];
  missing_keywords: string[];
  sections: { name: string; score: number; feedback: string }[];
  improvements: string[];
  summary: string;
};

export default function ATSScorePage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ATSResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const isPro = profile?.plan && profile.plan !== "free";
  const usesLeft = Math.max(0, 5 - (profile?.usage_count || 0));

  const handleAnalyze = async () => {
    if (!resumeFile) {
      toast.error("Please upload your resume! 🛑");
      return;
    }
    if (!jobDescription.trim()) {
      toast.error("Please paste the job description! 🛑");
      return;
    }

    setLoading(true);
    setResult(null);
    toast.loading("📊 AI is analyzing your resume...", { id: "ats" });

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("jobDescription", jobDescription);

      const res = await fetch("/api/ats-score", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setResult(data.analysis);
        // Refresh profile to update usage count
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: updated } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          setProfile(updated);
        }
        toast.success("ATS Analysis complete! ✅", { id: "ats" });
      } else if (data.error === "limit_reached") {
        toast.error("You've used all 5 free uses! Upgrade to continue. 🔒", { id: "ats" });
        setShowPricing(true);
      } else {
        toast.error("Failed: " + data.error, { id: "ats" });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: "ats" });
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

  const getScoreColor = (score: number) =>
    score >= 75 ? "var(--teal)" : score >= 50 ? "var(--gold)" : "var(--red)";

  return (
    <div className={isPro ? "pro-page" : ""} style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}>

      {/* Pro Aurora Background (only for pro users) */}
      {isPro && (
        <div className="pro-aurora">
          <div className="pro-aurora-blob pro-blob-1" />
          <div className="pro-aurora-blob pro-blob-2" />
          <div className="pro-aurora-blob pro-blob-3" />
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        {/* Pro badge only for paid users */}
        {isPro && (
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
              <Crown size={14} /> Pro — Unlimited
            </motion.div>
          </div>
        )}

        {/* Free tier uses-left badge */}
        {!isPro && profile && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "5px 14px", borderRadius: "20px",
              background: usesLeft > 0 ? "rgba(0,217,170,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${usesLeft > 0 ? "rgba(0,217,170,0.3)" : "rgba(239,68,68,0.3)"}`,
              fontSize: "11px", fontWeight: 700, fontFamily: "var(--font-heading)",
              color: usesLeft > 0 ? "var(--teal)" : "var(--red)",
              textTransform: "uppercase", letterSpacing: "1.5px",
            }}>
              {usesLeft > 0 ? `${usesLeft} free uses left` : "Free uses exhausted"}
            </div>
          </div>
        )}

        <h2 className="page-title">
          ATS Resume<br />
          <em className={isPro ? "pro-title-gradient" : ""} style={{ fontStyle: "normal", ...(!isPro ? { background: "linear-gradient(135deg, var(--ember), var(--blue))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : {}) }}>Score Checker</em>
        </h2>
        <p className="page-subtitle" style={{ maxWidth: "500px", margin: "8px auto 0" }}>
          Upload your resume and paste a job description — AI scores how well they match for ATS systems.
        </p>
      </div>

      {/* Input Card */}
      <motion.div className="glass-card" style={{ padding: "24px", marginBottom: "20px" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="section-label" style={{ marginBottom: "16px" }}>UPLOAD & ANALYZE</div>

        <div style={{ marginBottom: "16px" }}>
          <label className="label">1. Upload Your Resume</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              if (e.dataTransfer.files[0]) setResumeFile(e.dataTransfer.files[0]);
            }}
            className="pro-upload-zone"
            style={{
              border: "2px dashed var(--border)", borderRadius: "14px",
              padding: "28px", textAlign: "center", cursor: "pointer",
              background: resumeFile ? "rgba(212,168,67,0.04)" : "transparent",
              transition: "all 0.3s"
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: "none" }}
              onChange={e => {
                if (e.target.files?.[0]) setResumeFile(e.target.files[0]);
              }}
            />
            <Upload size={28} style={{ color: resumeFile ? "var(--pro-gold1)" : "var(--muted)", marginBottom: "8px", margin: "0 auto" }} />
            <div style={{ fontSize: "14px", fontWeight: 600, color: resumeFile ? "var(--pro-gold1)" : "var(--text)" }}>
              {resumeFile ? `✅ ${resumeFile.name}` : "Click or drag to upload"}
            </div>
            {!resumeFile && <p style={{ fontSize: "12px", color: "var(--sub)", marginTop: "4px" }}>Accepts PDF and DOCX</p>}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label className="label">2. Job Description</label>
          <textarea className="input" value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            style={{ minHeight: "140px", resize: "vertical" }} />
        </div>

        <motion.button
          onClick={handleAnalyze}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary"
          style={{ width: "100%", padding: "14px", fontSize: "14px" }}
        >
          {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Analyzing...</> : <><FileSearch size={16} /> Analyze ATS Match</>}
        </motion.button>
      </motion.div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Score + Summary */}
          <div className="glass-card" style={{ padding: "24px", marginBottom: "16px", textAlign: "center" }}>
            {/* Circular Score */}
            <div style={{ position: "relative", width: "120px", height: "120px", margin: "0 auto 16px" }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none"
                  stroke={getScoreColor(result.overall_score)} strokeWidth="8"
                  strokeDasharray={`${(result.overall_score / 100) * 327} 327`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  fontSize: "32px", fontFamily: "var(--font-heading)",
                  fontWeight: 800, color: getScoreColor(result.overall_score),
                }}>
                  {result.overall_score}
                </div>
                <div style={{ fontSize: "9px", fontFamily: "monospace", color: "var(--sub)", textTransform: "uppercase" }}>
                  ATS Score
                </div>
              </div>
            </div>

            {/* Summary */}
            <p style={{ fontSize: "13px", color: "var(--sub)", lineHeight: 1.7, maxWidth: "500px", margin: "0 auto" }}>
              {result.summary}
            </p>
          </div>

          {/* Keywords */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            {/* Matched */}
            <div className="glass-card" style={{ padding: "18px" }}>
              <div className="section-label" style={{ marginBottom: "12px", color: "var(--teal)" }}>
                ✅ MATCHED KEYWORDS ({result.matched_keywords.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {result.matched_keywords.map(k => (
                  <span key={k} style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "4px 10px", borderRadius: "6px",
                    background: "rgba(0,217,170,0.08)", border: "1px solid rgba(0,217,170,0.3)",
                    fontSize: "11px", color: "var(--teal)", fontWeight: 500,
                  }}>
                    <Check size={10} /> {k}
                  </span>
                ))}
              </div>
            </div>
            {/* Missing */}
            <div className="glass-card" style={{ padding: "18px" }}>
              <div className="section-label" style={{ marginBottom: "12px", color: "var(--red)" }}>
                ❌ MISSING KEYWORDS ({result.missing_keywords.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {result.missing_keywords.map(k => (
                  <span key={k} style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "4px 10px", borderRadius: "6px",
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                    fontSize: "11px", color: "var(--red)", fontWeight: 500,
                  }}>
                    <X size={10} /> {k}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Section Scores */}
          <div className="glass-card" style={{ padding: "20px", marginBottom: "16px" }}>
            <div className="section-label" style={{ marginBottom: "14px" }}>SECTION BREAKDOWN</div>
            {result.sections.map((sec, i) => (
              <div key={i} style={{
                padding: "12px 0",
                borderBottom: i < result.sections.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>{sec.name}</span>
                  <span style={{
                    fontSize: "14px", fontFamily: "var(--font-heading)",
                    fontWeight: 800, color: getScoreColor(sec.score),
                  }}>{sec.score}%</span>
                </div>
                {/* Progress Bar */}
                <div style={{
                  height: "6px", borderRadius: "3px",
                  background: "var(--border)", marginBottom: "6px", overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sec.score}%` }}
                    transition={{ duration: 0.8, delay: i * 0.15 }}
                    style={{
                      height: "100%", borderRadius: "3px",
                      background: getScoreColor(sec.score),
                    }}
                  />
                </div>
                <p style={{ fontSize: "11px", color: "var(--sub)" }}>{sec.feedback}</p>
              </div>
            ))}
          </div>

          {/* Improvement Suggestions */}
          <div className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div className="section-label" style={{ marginBottom: "14px", color: "var(--ember)" }}>
              💡 IMPROVEMENT SUGGESTIONS
            </div>
            {result.improvements.map((imp, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "10px 0",
                borderBottom: i < result.improvements.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <ArrowUpCircle size={16} style={{ color: "var(--ember)", flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "13px", color: "var(--sub)", lineHeight: 1.6 }}>{imp}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Responsive Keywords Grid */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 600px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />

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
