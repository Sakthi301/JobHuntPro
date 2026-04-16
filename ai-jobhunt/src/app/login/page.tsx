// ═══════════════════════════════════════════════════════════
// Login Page — Auth with Motion Animations
// ═══════════════════════════════════════════════════════════
// Fully responsive login/signup with:
// - Motion animations on card, inputs, and button
// - Sonner toast for errors/success (no more alert())
// - Theme-aware styling
// ═══════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogIn, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import styles from "./login.module.css";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Welcome to JobHunt Pro! 🚀");
          router.push("/");
          router.refresh();
        } else {
          toast.success("Account created! You can now sign in.");
          setTab("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast.success("Welcome back! 🎉");
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className={styles.authCard}
      >
        {/* Brand */}
        <div className={styles.authBrand}>
          <motion.img
            src="/logo.svg"
            alt="MyAIJobHunt Logo"
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            style={{ width: "64px", height: "64px", margin: "0 auto" }}
          />
          <h1>MyAIJobHunt</h1>
          <p>AI-Powered Career Command Center</p>
        </div>

        {/* Tabs */}
        <div className={styles.authTabs}>
          <button className={`${styles.authTab} ${tab === "signup" ? styles.on : ""}`}
            onClick={() => setTab("signup")} type="button">Create Account</button>
          <button className={`${styles.authTab} ${tab === "login" ? styles.on : ""}`}
            onClick={() => setTab("login")} type="button">Sign In</button>
        </div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.form
            key={tab}
            initial={{ opacity: 0, x: tab === "signup" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "signup" ? 20 : -20 }}
            transition={{ duration: 0.25 }}
            className={styles.authForm}
            onSubmit={handleAuth}
          >
            {tab === "signup" && (
              <div className={styles.authField}>
                <label>Full Name</label>
                <input type="text" placeholder="John Doe" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              </div>
            )}

            <div className={styles.authField}>
              <label>Email Address</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className={styles.authField}>
              <label>Password</label>
              <input type="password" placeholder="Min. 6 characters" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            <motion.button
              type="submit"
              className={styles.authBtn}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <div className={styles.spinner}></div>
              ) : tab === "signup" ? (
                <><UserPlus size={18} /> Create Account</>
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
