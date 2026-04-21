"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import { motion } from "motion/react";
import { toast } from "sonner";
import { FileText, Upload, WandSparkles, Download, Trash2 } from "lucide-react";

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2200): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    }),
  ]);
}

function getDownloadNameFromHeaders(headerValue: string | null) {
  if (!headerValue) return "tailored-resume.pdf";
  const match = /filename="([^"]+)"/i.exec(headerValue);
  return match?.[1] || "tailored-resume.pdf";
}

export default function ResumeBuilderPage() {
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("tailored-resume.pdf");
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
        // Keep feature usable even if profile request times out
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

  const clearForm = () => {
    setJobDescription("");
    setResumeText("");
    setResumeFile(null);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setDownloadName("tailored-resume.pdf");
  };

  const generateResume = async () => {
    if (!jobDescription.trim()) {
      toast.error("Please add a job description.");
      return;
    }
    if (!resumeText.trim() && !resumeFile) {
      toast.error("Please paste your existing resume or upload a file.");
      return;
    }

    setLoading(true);
    toast.loading("Generating a tailored resume PDF...", { id: "resume-builder" });

    try {
      const formData = new FormData();
      formData.append("jobDescription", jobDescription.trim());
      formData.append("resumeText", resumeText.trim());
      if (resumeFile) formData.append("resumeFile", resumeFile);

      const res = await fetch("/api/resume-builder", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        if (data.error === "limit_reached") {
          toast.error("You have used all 5 free uses. Upgrade to continue.", { id: "resume-builder" });
          window.dispatchEvent(new CustomEvent("show-pricing"));
          return;
        }
        toast.error(`Failed: ${data.error || "Unable to generate resume"}`, { id: "resume-builder" });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(url);

      const filename = getDownloadNameFromHeaders(res.headers.get("content-disposition"));
      setDownloadName(filename);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();

      toast.success("Resume generated and downloaded.", { id: "resume-builder" });

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
      toast.error(`Error: ${message}`, { id: "resume-builder" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
      <h2 className="page-title">Resume Builder</h2>
      <p className="page-subtitle" style={{ marginBottom: "14px" }}>
        Combine a target job description and your existing resume to generate a tailored PDF resume.
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
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <motion.div className="glass-card" style={{ padding: "24px" }} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}>
          <div className="section-label" style={{ marginBottom: "12px" }}>
            <FileText size={13} style={{ display: "inline", marginRight: "6px" }} />
            Job Description
          </div>
          <label className="label">Paste target JD</label>
          <textarea
            className="input"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste complete job description here..."
            style={{ minHeight: "320px", resize: "vertical" }}
          />
        </motion.div>

        <motion.div className="glass-card" style={{ padding: "24px" }} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}>
          <div className="section-label" style={{ marginBottom: "12px" }}>
            <Upload size={13} style={{ display: "inline", marginRight: "6px" }} />
            Existing Resume
          </div>

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
              {resumeFile ? `Selected: ${resumeFile.name}` : "Choose Resume File"}
            </button>
          </div>

          <label className="label">Or paste resume text</label>
          <textarea
            className="input"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your current resume text here (optional if file uploaded)..."
            style={{ minHeight: "230px", resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
            <motion.button
              disabled={loading}
              className="btn-primary"
              onClick={generateResume}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ flex: 1, minWidth: "170px" }}
            >
              <WandSparkles size={15} />
              {loading ? "Generating..." : "Generate Resume PDF"}
            </motion.button>
            <motion.button
              type="button"
              disabled={loading}
              onClick={clearForm}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "11px 16px",
                borderRadius: "12px",
                border: "1px solid var(--border2)",
                background: "transparent",
                color: "var(--sub)",
                cursor: "pointer",
              }}
            >
              <Trash2 size={14} style={{ marginRight: "6px", verticalAlign: "text-bottom" }} />
              Clear
            </motion.button>
          </div>
        </motion.div>
      </div>

      {downloadUrl && (
        <motion.div
          className="glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: "18px", padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
        >
          <div>
            <div className="section-label">Resume ready</div>
            <div style={{ fontSize: "13px", color: "var(--sub)", marginTop: "4px" }}>{downloadName}</div>
          </div>
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
        </motion.div>
      )}
    </div>
  );
}
