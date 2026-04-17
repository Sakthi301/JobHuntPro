// ═══════════════════════════════════════════════════════════
// Setup Page — Profile & Preferences (Fully Responsive)
// ═══════════════════════════════════════════════════════════
// Features:
// - Responsive grid (2-col → 1-col on mobile)
// - AutoAnimate on chip tags (smooth add/remove)
// - Sonner toasts (replaces alert())
// - Motion hover effects on save button
// ═══════════════════════════════════════════════════════════

"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Upload, Crown, Loader2 } from "lucide-react";

export default function SetupPage() {
  // --- State ---
  const [profile, setProfile] = useState({
    name: "", exp: "", role: "", industry: "",
    skills: "", achieve: "", minSal: "", shift: "any", jobType: "Full-time"
  });
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [locs, setLocs] = useState<string[]>([]);
  const [locInput, setLocInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userPlan, setUserPlan] = useState("free");
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AutoAnimate refs for chip containers
  const [rolesRef] = useAutoAnimate();
  const [locsRef] = useAutoAnimate();

  const supabase = createClient();
  const router = useRouter();

  // --- Load profile on mount ---
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (data) {
        setProfile({
          name: data.name || user.user_metadata?.full_name || "",
          exp: data.experience || "", role: data.current_role || "",
          industry: data.industry || "", skills: data.skills || "",
          achieve: data.achievement || "", minSal: data.min_salary || "",
          shift: data.work_preference || "any", jobType: data.job_type || "Full-time"
        });
        setRoles(data.target_roles || []);
        setLocs(data.target_locations || []);
        if (data.plan) setUserPlan(data.plan);
      }
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  // --- Chip Helpers ---
  const addRole = () => {
    if (roleInput.trim() && !roles.includes(roleInput.trim())) {
      setRoles([...roles, roleInput.trim()]); setRoleInput("");
    }
  };
  const addLoc = () => {
    if (locInput.trim() && !locs.includes(locInput.trim())) {
      setLocs([...locs, locInput.trim()]); setLocInput("");
    }
  };
  const removeRole = (r: string) => setRoles(roles.filter(x => x !== r));
  const removeLoc = (l: string) => setLocs(locs.filter(x => x !== l));

  // --- Resume Upload Handler (Pro Only) ---
  const handleResumeUpload = async (file: File) => {
    setParsing(true);
    toast.loading("🤖 AI is reading your resume...", { id: "resume" });

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/resume-parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.data) {
        const d = data.data;
        setProfile({
          name: d.name || profile.name,
          exp: d.experience || profile.exp,
          role: d.current_role || profile.role,
          industry: d.industry || profile.industry,
          skills: d.skills || profile.skills,
          achieve: d.achievement || profile.achieve,
          minSal: d.min_salary || profile.minSal,
          shift: profile.shift,
          jobType: profile.jobType,
        });
        if (d.target_roles?.length) setRoles(d.target_roles);
        if (d.target_locations?.length) setLocs(d.target_locations);
        toast.success("Resume parsed! All fields auto-filled ✅", { id: "resume" });
      } else {
        toast.error("Failed: " + (data.error || "Unknown error"), { id: "resume" });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: "resume" });
    } finally {
      setParsing(false);
    }
  };

  // --- Save to Supabase ---
  const saveProfile = async () => {
    // Validation
    if (!profile.name.trim() || !profile.exp.trim() || !profile.role.trim() || !profile.industry || !profile.skills.trim() || !profile.achieve.trim() || !profile.minSal.trim()) {
      toast.error("Please fill out all text fields before starting your hunt! 🛑");
      return;
    }
    if (roles.length === 0 || locs.length === 0) {
      toast.error("Please add at least one Target Job Role and Location! 🎯");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase.from("profiles").upsert({
        id: user.id, email: user.email, name: profile.name,
        experience: profile.exp, current_role: profile.role,
        industry: profile.industry, skills: profile.skills,
        achievement: profile.achieve, target_roles: roles,
        target_locations: locs, min_salary: profile.minSal,
        work_preference: profile.shift, job_type: profile.jobType,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      toast.success("Profile saved! Redirecting to dashboard...");
      setTimeout(() => router.push("/"), 1500);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
        <div className="skeleton" style={{ width: "100%", maxWidth: "700px", height: "400px" }}></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>

      {/* ─── Page Header ─── */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h2 className="page-title">
          Your AI Job Hunt<br />
          <em style={{
            fontStyle: "normal",
            background: "linear-gradient(135deg, var(--ember), var(--gold))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>Command Center</em>
        </h2>
        <p className="page-subtitle" style={{ maxWidth: "500px", margin: "8px auto 0" }}>
          Set up your profile once. AI uses this data to scan, score, and generate — all stored securely.
        </p>
      </div>

      {/* ─── Pro: Resume Upload Zone (hidden for free users) ─── */}
      {userPlan !== "free" && (
        <motion.div
          className="glass-card pro-upload-zone"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "28px", marginBottom: "16px", textAlign: "center",
            cursor: "pointer", position: "relative",
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => {
            e.preventDefault(); e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleResumeUpload(file);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleResumeUpload(file);
            }}
          />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px",
            padding: "4px 12px", borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(212,168,67,0.12), rgba(245,215,110,0.06))",
            border: "1px solid rgba(212,168,67,0.25)",
          }}>
            <Crown size={12} style={{ color: "var(--pro-gold2)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--pro-gold2)", textTransform: "uppercase", letterSpacing: "1px" }}>Pro Feature</span>
          </div>
          {parsing ? (
            <>
              <Loader2 size={32} style={{ color: "var(--pro-gold1)", animation: "spin 1s linear infinite", marginBottom: "8px" }} />
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>AI is reading your resume...</div>
            </>
          ) : (
            <>
              <Upload size={32} style={{ color: "var(--pro-gold1)", marginBottom: "8px" }} />
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>Upload Resume to Auto-Fill</div>
              <p style={{ fontSize: "12px", color: "var(--sub)", marginTop: "4px" }}>Drag & drop a PDF or Word file here, or click</p>
            </>
          )}
        </motion.div>
      )}

      {/* ─── Profile Section ─── */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: "16px" }}>
        <div className="section-label" style={{ marginBottom: "20px" }}>YOUR PROFILE</div>

        {/* Responsive 2-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "14px" }}>
          <div><label className="label">Full Name</label>
            <input className="input" type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
          <div><label className="label">Experience</label>
            <input className="input" type="text" value={profile.exp} onChange={e => setProfile({ ...profile, exp: e.target.value })} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "14px" }}>
          <div><label className="label">Current Role</label>
            <input className="input" type="text" value={profile.role} onChange={e => setProfile({ ...profile, role: e.target.value })} placeholder="Software Engineer" /></div>
          <div><label className="label">Industry</label>
            <select className="input" value={profile.industry} onChange={e => setProfile({ ...profile, industry: e.target.value })}>
              <option value="">Select industry...</option>
              {["Software / IT", "Telecom / Networking", "Data Science / AI", "Finance / Banking", "Healthcare", "Marketing / Sales", "Design / Creative", "Other"].map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select></div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label className="label">Core Skills (comma-separated)</label>
          <textarea className="input" value={profile.skills} onChange={e => setProfile({ ...profile, skills: e.target.value })} style={{ minHeight: "75px", resize: "vertical" }} placeholder="Python, React, AWS, SQL..." />
        </div>

        <div>
          <label className="label">Key Achievement</label>
          <input className="input" type="text" value={profile.achieve} onChange={e => setProfile({ ...profile, achieve: e.target.value })} />
        </div>
      </div>

      {/* ─── Search Preferences ─── */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: "16px" }}>
        <div className="section-label" style={{ marginBottom: "20px" }}>SEARCH PREFERENCES</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "18px" }}>
          <div>
            <label className="label">Expected Salary</label>
            <input className="input" type="text" value={profile.minSal} onChange={e => setProfile({ ...profile, minSal: e.target.value })} placeholder="e.g. ₹12 LPA" />
          </div>
          <div>
            <label className="label">Work Preference</label>
            <select className="input" value={profile.shift} onChange={e => setProfile({ ...profile, shift: e.target.value })}>
              <option value="any">Any</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site Only</option>
            </select>
          </div>
          <div>
            <label className="label">Job Type</label>
            <select className="input" value={profile.jobType} onChange={e => setProfile({ ...profile, jobType: e.target.value })}>
              <option value="Full-time">Full-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
              <option value="Part-time">Part-time</option>
              <option value="Freelance">Freelance</option>
            </select>
          </div>
        </div>

        {/* Target Roles with AutoAnimate */}
        <div style={{ marginBottom: "18px" }}>
          <label className="label">Target Job Roles</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input className="input" style={{ flex: 1 }} type="text" value={roleInput}
              onChange={e => setRoleInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRole())}
              placeholder="e.g. Frontend Developer" />
            <button onClick={addRole} style={{ padding: "0 20px", background: "rgba(0,217,170,.1)", border: "1px solid rgba(0,217,170,.4)", color: "var(--teal)", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap" }}>+ Add</button>
          </div>
          <div ref={rolesRef} style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {roles.map(r => (
              <span key={r} onClick={() => removeRole(r)} className="chip chip-ember">
                {r} <span style={{ opacity: 0.5 }}>✕</span>
              </span>
            ))}
          </div>
        </div>

        {/* Target Locations with AutoAnimate */}
        <div>
          <label className="label">Preferred Locations</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input className="input" style={{ flex: 1 }} type="text" value={locInput}
              onChange={e => setLocInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLoc())}
              placeholder="e.g. London, Remote..." />
            <button onClick={addLoc} style={{ padding: "0 20px", background: "rgba(0,217,170,.1)", border: "1px solid rgba(0,217,170,.4)", color: "var(--teal)", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap" }}>+ Add</button>
          </div>
          <div ref={locsRef} style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {locs.map(l => (
              <span key={l} onClick={() => removeLoc(l)} className="chip chip-teal">
                📍 {l} <span style={{ opacity: 0.5 }}>✕</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Save Button ─── */}
      <motion.button
        onClick={saveProfile}
        disabled={saving}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="btn-primary"
        style={{ width: "100%", padding: "15px", fontSize: "15px" }}
      >
        {saving ? "Saving securely..." : "⚡ Save Everything & Start Hunting"}
      </motion.button>
    </div>
  );
}
