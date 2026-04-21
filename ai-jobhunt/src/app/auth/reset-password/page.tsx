"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import styles from "./reset-password.module.css";

function validateStrongPassword(password: string) {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one special character.";
  return "";
}

function parseRecoveryTokensFromHash() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  if (!accessToken || !refreshToken || type !== "recovery") return null;
  return { accessToken, refreshToken };
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [validRecovery, setValidRecovery] = useState(false);
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  useEffect(() => {
    const bootstrapRecovery = async () => {
      const tokens = parseRecoveryTokensFromHash();
      if (tokens) {
        const { error } = await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        if (error) {
          setValidRecovery(false);
          setCheckingSession(false);
          return;
        }
        window.history.replaceState({}, "", window.location.pathname);
      }

      const { data } = await supabase.auth.getSession();
      setValidRecovery(Boolean(data.session));
      setCheckingSession(false);
    };
    bootstrapRecovery();
  }, [supabase]);

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message || "Unable to update password.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    toast.success("Password updated. Please sign in with your new password.");
    router.push("/login");
    router.refresh();
  };

  if (checkingSession) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.sub}>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!validRecovery) {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1>Link Expired</h1>
          <p className={styles.sub}>Reset link is invalid or expired. Please request a new one from Sign In.</p>
          <button className={styles.primary} onClick={() => router.push("/login")}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        onSubmit={handleReset}
        className={styles.card}
      >
        <div className={styles.iconRow}>
          <ShieldCheck size={18} />
          <span>Secure Password Reset</span>
        </div>
        <h1>Create New Password</h1>
        <p className={styles.sub}>Choose a strong password to protect your account.</p>

        <label className={styles.label}><LockKeyhole size={14} /> New Password</label>
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="10+ chars, upper/lower/number/symbol"
          autoComplete="new-password"
          required
        />

        <label className={styles.label}><LockKeyhole size={14} /> Confirm Password</label>
        <input
          className={styles.input}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          required
        />

        <button className={styles.primary} type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>
      </motion.form>
    </div>
  );
}
