"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  BookOpenCheck,
  Upload,
  WandSparkles,
  Download,
  ChevronDown,
  ChevronUp,
  TimerReset,
  Building2,
  BriefcaseBusiness,
} from "lucide-react";

type QAItem = {
  id?: number;
  category?: string;
  difficulty?: string;
  source?: string;
  question?: string;
  answer?: string;
  keywords?: string[];
  quick_recall?: string;
  realtime_example?: string;
};

type QuestionBank = {
  title?: string;
  company?: string;
  role?: string;
  revision_keywords?: string[];
  questions?: QAItem[];
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2200): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    }),
  ]);
}

function base64ToBlob(base64: string, contentType = "application/pdf") {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) {
    bytes[index] = raw.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType });
}

export default function QuestionBankPage() {
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [questionCount, setQuestionCount] = useState(30);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("question-bank.pdf");
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userResult = await withTimeout(supabase.auth.getUser());
        const user = userResult.data.user;
        if (!user) return;
        const profileResult = await withTimeout(
          supabase.from("profiles").select("*").eq("id", user.id).single()
        );
        setProfile(profileResult.data as Profile);
      } catch {
        // Keep page functional even if profile fetch fails.
      }
    };
    loadProfile();
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const usesLeft = useMemo(() => {
    if (!profile || profile.plan !== "free") return null;
    return Math.max(0, 5 - (profile.usage_count || 0));
  }, [profile]);

  const generateBank = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please add the job description.");
      return;
    }
    if (!resumeText.trim() && !resumeFile) {
      toast.error("Please upload/paste resume content.");
      return;
    }

    setLoading(true);
    toast.loading("Building your last-minute question bank...", { id: "qbank" });

    try {
      const formData = new FormData();
      formData.append("company", company.trim());
      formData.append("role", role.trim());
      formData.append("questionCount", String(questionCount));
      formData.append("jobDescription", jobDescription.trim());
      formData.append("resumeText", resumeText.trim());
      if (resumeFile) formData.append("resumeFile", resumeFile);

      const res = await fetch("/api/question-bank", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error === "limit_reached") {
          toast.error("You have used all 5 free uses. Upgrade to continue.", { id: "qbank" });
          window.dispatchEvent(new CustomEvent("show-pricing"));
          return;
        }
        toast.error(`Failed: ${data.error || "Could not generate question bank"}`, { id: "qbank" });
        return;
      }

      const generatedBank = data.bank as QuestionBank;
      setBank(generatedBank);
      setExpandedId(generatedBank.questions?.[0]?.id || 1);

      const pdfBlob = base64ToBlob(data.pdfBase64 as string);
      const pdfUrl = URL.createObjectURL(pdfBlob);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(pdfUrl);
      setDownloadName((data.filename as string) || "question-bank.pdf");

      const anchor = document.createElement("a");
      anchor.href = pdfUrl;
      anchor.download = (data.filename as string) || "question-bank.pdf";
      anchor.click();

      toast.success("Question bank generated and downloaded.", { id: "qbank" });

      const userResult = await withTimeout(supabase.auth.getUser());
      const user = userResult.data.user;
      if (user) {
        const profileResult = await withTimeout(
          supabase.from("profiles").select("*").eq("id", user.id).single()
        );
        setProfile(profileResult.data as Profile);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Error: ${message}`, { id: "qbank" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
      <h2 className="page-title">Interview and Exam Question Bank</h2>
      <p className="page-subtitle" style={{ marginBottom: "14px" }}>
        Generate a large Q/A revision bank from job description, company patterns, and your resume with memory keywords and real examples.
      </p>

      {usesLeft !== null && (
        <div style={{ marginBottom: "20px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "18px",
              background: usesLeft > 0 ? "rgba(0,217,170,.08)" : "rgba(239,68,68,.08)",
              border: `1px solid ${usesLeft > 0 ? "rgba(0,217,170,.35)" : "rgba(239,68,68,.35)"}`,
              color: usesLeft > 0 ? "var(--teal)" : "var(--red)",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {usesLeft > 0 ? `${usesLeft} free uses left` : "Free uses exhausted - upgrade to continue"}
          </span>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <motion.div className="glass-card" style={{ padding: "22px" }} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}>
          <div className="section-label" style={{ marginBottom: "14px" }}>
            <Building2 size={13} style={{ display: "inline", marginRight: "6px" }} />
            Target Context
          </div>

          <label className="label">Company (optional)</label>
          <input
            className="input"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Google, Microsoft, TCS"
            style={{ marginBottom: "12px" }}
          />

          <label className="label">Role (optional)</label>
          <input
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Frontend Engineer"
            style={{ marginBottom: "12px" }}
          />

          <label className="label">Job Description</label>
          <textarea
            className="input"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste full JD with responsibilities and skills..."
            style={{ minHeight: "260px", resize: "vertical" }}
          />
        </motion.div>

        <motion.div className="glass-card" style={{ padding: "22px" }} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}>
          <div className="section-label" style={{ marginBottom: "14px" }}>
            <BriefcaseBusiness size={13} style={{ display: "inline", marginRight: "6px" }} />
            Resume + Generation
          </div>

          <label className="label">Question count (12-50)</label>
          <input
            className="input"
            type="number"
            min={12}
            max={50}
            value={questionCount}
            onChange={(e) => setQuestionCount(Math.min(50, Math.max(12, Number(e.target.value) || 12)))}
            style={{ marginBottom: "12px" }}
          />

          <label className="label">Upload resume file (PDF/DOCX/TXT)</label>
          <div
            style={{
              border: "1px dashed var(--border2)",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "12px",
              background: "var(--glass)",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: "none" }}
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid var(--border2)",
                background: "transparent",
                color: "var(--sub)",
                cursor: "pointer",
              }}
            >
              <Upload size={14} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} />
              {resumeFile ? `Selected: ${resumeFile.name}` : "Choose Resume File"}
            </button>
          </div>

          <label className="label">Or paste resume text</label>
          <textarea
            className="input"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste existing resume text..."
            style={{ minHeight: "180px", resize: "vertical", marginBottom: "12px" }}
          />

          <motion.button
            className="btn-primary"
            onClick={generateBank}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ width: "100%" }}
          >
            <WandSparkles size={15} />
            {loading ? "Generating..." : "Generate Q&A Book Bank PDF"}
          </motion.button>
        </motion.div>
      </div>

      {bank && (
        <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: "16px", padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div className="section-label">
                <BookOpenCheck size={13} style={{ display: "inline", marginRight: "6px" }} />
                Generated Question Bank
              </div>
              <div style={{ fontSize: "14px", marginTop: "5px" }}>{bank.title || "Question Bank"}</div>
              <div style={{ fontSize: "12px", color: "var(--sub)", marginTop: "2px" }}>
                {(bank.questions || []).length} questions prepared for fast revision
              </div>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadName}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(0,217,170,.45)",
                  background: "rgba(0,217,170,.08)",
                  color: "var(--teal)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <Download size={15} />
                Download PDF Again
              </a>
            )}
          </div>

          {(bank.revision_keywords || []).length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <div className="label">Last-minute keywords</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {(bank.revision_keywords || []).slice(0, 28).map((keyword, index) => (
                  <span key={`${keyword}-${index}`} className="chip chip-teal" style={{ cursor: "default" }}>
                    <TimerReset size={12} />
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div style={{ marginTop: "14px" }}>
        <AnimatePresence>
          {(bank?.questions || []).map((item, index) => {
            const id = item.id || index + 1;
            const open = expandedId === id;
            return (
              <motion.div
                key={id}
                className="glass-card"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: "10px", overflow: "hidden" }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--sub)", marginBottom: "4px" }}>
                      Q{id} | {item.category || "General"} | {item.difficulty || "Mixed"} | {item.source || "Mixed"}
                    </div>
                    <div style={{ fontSize: "14px", lineHeight: 1.5 }}>{item.question}</div>
                  </div>
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--sub)", lineHeight: 1.7 }}>
                          <strong style={{ color: "var(--teal)" }}>Answer:</strong> {item.answer}
                        </div>
                        {(item.keywords || []).length > 0 && (
                          <div style={{ marginTop: "9px", fontSize: "12px", color: "var(--gold)" }}>
                            <strong>Keywords:</strong> {(item.keywords || []).join(", ")}
                          </div>
                        )}
                        {item.quick_recall && (
                          <div style={{ marginTop: "7px", fontSize: "12px", color: "var(--ember)" }}>
                            <strong>Quick Recall:</strong> {item.quick_recall}
                          </div>
                        )}
                        {item.realtime_example && (
                          <div style={{ marginTop: "7px", fontSize: "12px", color: "var(--sub)" }}>
                            <strong>Real-Time Example:</strong> {item.realtime_example}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
