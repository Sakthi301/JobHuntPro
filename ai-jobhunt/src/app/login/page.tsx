"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogIn, UserPlus, ShieldCheck, Mail, Lock, Sparkles, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import styles from "./login.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "invalid.com",
  "fake.com",
]);

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

function validateEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return "Enter a valid email address.";
  const domain = normalized.split("@")[1] || "";
  if (BLOCKED_DOMAINS.has(domain)) return "Please use your real email inbox.";
  return "";
}

function validateStrongPassword(password: string) {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one special character.";
  return "";
}

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      toast.error(emailError);
      return;
    }
    if (tab === "signup") {
      if (name.trim().length < 2) {
        toast.error("Enter your full name.");
        return;
      }
      const passwordError = validateStrongPassword(password);
      if (passwordError) {
        toast.error(passwordError);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
          },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Welcome to SkillScan.");
          router.push("/");
          router.refresh();
        } else {
          toast.success("Check your email to verify your account.");
          setTab("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back.");
        router.push("/");
        router.refresh();
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      setOauthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      toast.error(emailError);
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent.");
      setShowForgot(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setResetLoading(false);
    }
  };

  const passwordHint =
    tab === "signup"
      ? "Use 10+ chars with upper/lowercase, number, and symbol."
      : "Enter your password.";

  return (
    <div className={styles.authContainer}>
      <div className={styles.bgMesh} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        className={styles.authCard}
      >
        <div className={styles.authBrand}>
          <motion.img
            src="/logo.svg"
            alt="SkillScan Logo"
            whileHover={{ rotate: 8, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 320 }}
            className={styles.brandLogo}
          />
          <h1>SkillScan</h1>
          <p>Secure AI job-hunt workspace with pro-grade auth.</p>
        </div>

        <div className={styles.featureStrip}>
          <span><ShieldCheck size={14} /> Secure auth</span>
          <span><Sparkles size={14} /> Premium UI</span>
          <span><Lock size={14} /> Encrypted sessions</span>
        </div>

        <div className={styles.authTabs}>
          <button
            className={`${styles.authTab} ${tab === "signup" ? styles.on : ""}`}
            onClick={() => setTab("signup")}
            type="button"
          >
            Create Account
          </button>
          <button
            className={`${styles.authTab} ${tab === "login" ? styles.on : ""}`}
            onClick={() => setTab("login")}
            type="button"
          >
            Sign In
          </button>
        </div>

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleAuth}
          disabled={oauthLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.3 14.8 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.2 0-.5 0-.9-.1-1.3H12z" />
          </svg>
          {oauthLoading ? "Redirecting..." : "Continue with Google"}
        </button>

        <AnimatePresence mode="wait">
          <motion.form
            key={tab}
            initial={{ opacity: 0, x: tab === "signup" ? -14 : 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "signup" ? 14 : -14 }}
            transition={{ duration: 0.22 }}
            className={styles.authForm}
            onSubmit={handleAuth}
          >
            {tab === "signup" && (
              <div className={styles.authField}>
                <label><UserPlus size={14} /> Full Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className={styles.authField}>
              <label><Mail size={14} /> Email Address</label>
              <input
                type="email"
                placeholder="name@yourdomain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.authField}>
              <label><Lock size={14} /> Password</label>
              <input
                type="password"
                placeholder={tab === "signup" ? "Create strong password" : "Enter password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                required
                minLength={tab === "signup" ? 10 : 6}
              />
              <small className={styles.fieldHint}>{passwordHint}</small>
            </div>

            {tab === "signup" && (
              <div className={styles.authField}>
                <label><KeyRound size={14} /> Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {tab === "login" && (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgot(true);
                }}
              >
                Forgot password?
              </button>
            )}

            <motion.button
              type="submit"
              className={styles.authBtn}
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {loading ? (
                <div className={styles.spinner}></div>
              ) : tab === "signup" ? (
                <><UserPlus size={18} /> Create Secure Account</>
              ) : (
                <><LogIn size={18} /> Sign In Securely</>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>

        <AnimatePresence>
          {showForgot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.modalOverlay}
            >
              <motion.form
                initial={{ scale: 0.95, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 8 }}
                onSubmit={handleForgotPassword}
                className={styles.modalCard}
              >
                <h3>Reset Password</h3>
                <p>We will send a secure reset link to your email.</p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@yourdomain.com"
                  required
                />
                <div className={styles.modalActions}>
                  <button type="button" className={styles.subtleBtn} onClick={() => setShowForgot(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.authBtn} disabled={resetLoading}>
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
