// ═══════════════════════════════════════════════════════════
// PricingModal — Subscription Upgrade Overlay
// ═══════════════════════════════════════════════════════════
// Features:
// - Glassmorphism design with 3 plan cards
// - Razorpay checkout integration
// - Motion animations on cards
// - Responsive layout (3-col → 1-col on mobile)
// ═══════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { X, Zap, Crown, Rocket, Check } from "lucide-react";

// Declare Razorpay on window for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

// Plan definitions
const PLANS = [
  {
    id: "weekly",
    name: "Weekly",
    price: "₹49",
    period: "/week",
    icon: Zap,
    color: "var(--teal)",
    colorAlpha: "rgba(0,217,170,0.1)",
    borderAlpha: "rgba(0,217,170,0.3)",
    features: [
      "Unlimited Profile Scans",
      "AI Cover Notes",
      "Interview Prep Coach",
      "ATS Resume Scoring",
      "Opportunity Tracker",
      "Analytics Dashboard",
    ],
    popular: false,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "₹149",
    period: "/month",
    icon: Crown,
    color: "var(--ember)",
    colorAlpha: "rgba(255,107,53,0.1)",
    borderAlpha: "rgba(255,107,53,0.3)",
    features: [
      "Unlimited Profile Scans",
      "AI Cover Notes",
      "Interview Prep Coach",
      "ATS Resume Scoring",
      "Opportunity Tracker",
      "Analytics Dashboard",
      "Save 24% vs Weekly",
    ],
    popular: true,
  },
  {
    id: "yearly",
    name: "Pro Yearly",
    price: "₹999",
    period: "/year",
    icon: Rocket,
    color: "var(--gold)",
    colorAlpha: "rgba(245,200,66,0.1)",
    borderAlpha: "rgba(245,200,66,0.3)",
    features: [
      "Unlimited Profile Scans",
      "AI Cover Notes",
      "Interview Prep Coach",
      "ATS Resume Scoring",
      "Opportunity Tracker",
      "Analytics Dashboard",
      "Priority Support",
      "Save 61% vs Weekly",
    ],
    popular: false,
  },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail: string;
  userName: string;
};

export default function PricingModal({ isOpen, onClose, onSuccess, userEmail, userName }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  // --- Load Razorpay Script ---
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // --- Handle Plan Purchase ---
  const handlePurchase = async (planId: string) => {
    setLoading(planId);

    // Step 1: Load Razorpay script
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error("Payment gateway failed to load. Please try again.");
      setLoading(null);
      return;
    }

    // Step 2: Create order on backend
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Order creation failed: " + data.error);
        setLoading(null);
        return;
      }

      // Step 3: Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: "INR",
        name: "SkillScan",
        description: data.plan_label,
        order_id: data.order_id,
        prefill: {
          name: userName,
          email: userEmail,
        },
        theme: {
          color: "#FF6B35",
        },
        handler: async (response: any) => {
          // Step 4: Verify payment on backend
          toast.loading("Verifying payment...", { id: "verify" });
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              toast.success("🎉 Payment successful! You're now on the " + planId + " plan!", { id: "verify" });
              onSuccess();
            } else {
              toast.error("Verification failed: " + verifyData.error, { id: "verify" });
            }
          } catch (e: any) {
            toast.error("Verification error: " + e.message, { id: "verify" });
          }
          setLoading(null);
        },
        modal: {
          ondismiss: () => {
            setLoading(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast.error("Error: " + e.message);
      setLoading(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "820px",
              background: "var(--card-bg)", borderRadius: "20px",
              border: "1px solid var(--border)",
              overflow: "hidden",
              maxHeight: "90vh", overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "28px 28px 0",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            }}>
              <div>
                <h2 style={{
                  fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 800,
                  background: "linear-gradient(135deg, var(--ember), var(--gold))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  marginBottom: "6px",
                }}>
                  Unlock Advanced Analytics 🚀
                </h2>
                <p style={{ fontSize: "13px", color: "var(--sub)", lineHeight: 1.6 }}>
                  You&apos;ve used all 5 free uses. Upgrade to unlock unlimited AI scans, cover notes, interview prep & ATS scoring.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                style={{
                  background: "var(--glass)", border: "1px solid var(--border)",
                  borderRadius: "10px", width: "36px", height: "36px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--sub)", flexShrink: 0,
                }}
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Plan Cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px", padding: "24px 28px 28px",
            }}>
              {PLANS.map((plan, i) => {
                const Icon = plan.icon;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -4, boxShadow: `0 8px 30px ${plan.borderAlpha}` }}
                    style={{
                      position: "relative",
                      background: plan.colorAlpha,
                      border: `1px solid ${plan.borderAlpha}`,
                      borderRadius: "16px", padding: "24px",
                      display: "flex", flexDirection: "column",
                      transition: "box-shadow 0.3s",
                    }}
                  >
                    {/* Popular Badge */}
                    {plan.popular && (
                      <div style={{
                        position: "absolute", top: "-1px", right: "16px",
                        background: plan.color, color: "#fff",
                        fontSize: "9px", fontWeight: 800, fontFamily: "var(--font-heading)",
                        padding: "4px 12px", borderRadius: "0 0 8px 8px",
                        textTransform: "uppercase", letterSpacing: "0.5px",
                      }}>
                        Most Popular
                      </div>
                    )}

                    {/* Icon + Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "12px",
                        background: plan.colorAlpha, border: `1px solid ${plan.borderAlpha}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: plan.color,
                      }}>
                        <Icon size={20} />
                      </div>
                      <div style={{
                        fontFamily: "var(--font-heading)", fontSize: "16px",
                        fontWeight: 700, color: "var(--text)",
                      }}>
                        {plan.name}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ marginBottom: "18px" }}>
                      <span style={{
                        fontFamily: "var(--font-heading)", fontSize: "32px",
                        fontWeight: 800, color: plan.color,
                      }}>
                        {plan.price}
                      </span>
                      <span style={{ fontSize: "13px", color: "var(--sub)" }}>
                        {plan.period}
                      </span>
                    </div>

                    {/* Features */}
                    <div style={{ flex: 1, marginBottom: "18px" }}>
                      {plan.features.map((feat) => (
                        <div key={feat} style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          fontSize: "12px", color: "var(--sub)", marginBottom: "8px",
                        }}>
                          <Check size={14} style={{ color: plan.color, flexShrink: 0 }} />
                          {feat}
                        </div>
                      ))}
                    </div>

                    {/* Buy Button */}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={loading === plan.id}
                      onClick={() => handlePurchase(plan.id)}
                      style={{
                        width: "100%", padding: "12px",
                        borderRadius: "12px", fontSize: "13px", fontWeight: 700,
                        border: plan.popular ? "none" : `1px solid ${plan.borderAlpha}`,
                        background: plan.popular ? plan.color : "transparent",
                        color: plan.popular ? "#fff" : plan.color,
                        cursor: "pointer",
                        opacity: loading && loading !== plan.id ? 0.5 : 1,
                      }}
                    >
                      {loading === plan.id ? "Processing..." : `Choose ${plan.name}`}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              padding: "0 28px 20px", textAlign: "center",
              fontSize: "11px", color: "var(--muted)",
            }}>
              🔒 Payments secured by Razorpay. Cancel anytime.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
