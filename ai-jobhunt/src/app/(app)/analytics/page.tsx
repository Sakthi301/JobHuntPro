// ═══════════════════════════════════════════════════════════
// Analytics Page — Charts & Statistics (Responsive)
// ═══════════════════════════════════════════════════════════
// Features:
// - CountUp animated stat numbers
// - ApexCharts donut (dynamic import, no SSR)
// - Responsive grid layout
// - Motion entrance animations
// ═══════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Application } from "@/types";
import { motion } from "motion/react";
import CountUp from "react-countup";
import dynamic from "next/dynamic";

// ApexCharts must be loaded client-side only
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function AnalyticsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [isClient, setIsClient] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setIsClient(true);
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("applications").select("*").eq("user_id", user.id);
      setApps(data || []);
    }
    load();
  }, []);

  if (!isClient) return null;

  // Stats
  const interviews = apps.filter(a => a.status === "interview").length;
  const offers = apps.filter(a => a.status === "offer").length;
  const rejected = apps.filter(a => a.status === "rejected").length;
  const rate = apps.length ? Math.round(((interviews + offers) / apps.length) * 100) : 0;

  // Chart data
  const statuses = ["applied", "interview", "offer", "rejected"];
  const statusCounts = statuses.map(s => apps.filter(a => a.status === s).length);

  const chartOptions: any = {
    chart: { background: "transparent", foreColor: "var(--sub)", toolbar: { show: false } },
    labels: statuses.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    colors: ["#F5C842", "#4F8EF7", "#00D9AA", "#FF4757"],
    legend: { position: "bottom", labels: { colors: "var(--sub)" } },
    plotOptions: { pie: { donut: { size: "65%", labels: { show: true, total: { show: true, label: "Total", color: "var(--sub)", formatter: () => `${apps.length}` } } } } },
    tooltip: { theme: "dark" },
    dataLabels: { enabled: false },
    stroke: { show: false },
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

      {/* Page Header */}
      <h2 className="page-title">📊 Analytics</h2>
      <p className="page-subtitle" style={{ marginBottom: "28px" }}>Your job hunt performance at a glance</p>

      {/* ─── Stats Grid ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "28px" }}>
        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="stat-label">Total Apps</div>
          <div className="stat-value"><CountUp end={apps.length} duration={1.5} /></div>
        </motion.div>

        <motion.div className="stat-card" style={{ borderTop: "2px solid var(--blue)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="stat-label">Interviews</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}><CountUp end={interviews} duration={1.5} /></div>
        </motion.div>

        <motion.div className="stat-card" style={{ borderTop: "2px solid var(--teal)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="stat-label">Offers</div>
          <div className="stat-value" style={{ color: "var(--teal)" }}><CountUp end={offers} duration={1.5} /></div>
        </motion.div>

        <motion.div className="stat-card" style={{ borderTop: "2px solid var(--purple)" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="stat-label">Success Rate</div>
          <div className="stat-value" style={{ color: "var(--purple)" }}><CountUp end={rate} duration={1.5} suffix="%" /></div>
        </motion.div>
      </div>

      {/* ─── Charts Grid ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px" }}>

        {/* Donut Chart */}
        <motion.div className="glass-card" style={{ padding: "24px" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="section-label" style={{ marginBottom: "18px" }}>Status Breakdown</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Chart options={chartOptions} series={statusCounts} type="donut" width="100%" height={280} />
          </div>
        </motion.div>

        {/* Summary Card */}
        <motion.div className="glass-card" style={{ padding: "24px" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="section-label" style={{ marginBottom: "18px" }}>Pipeline Summary</div>
          {statuses.map((s, i) => {
            const count = statusCounts[i];
            const pct = apps.length ? Math.round((count / apps.length) * 100) : 0;
            const colors = ["var(--gold)", "var(--blue)", "var(--teal)", "var(--red)"];
            return (
              <div key={s} style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, textTransform: "capitalize" }}>{s}</span>
                  <span style={{ fontSize: "13px", color: "var(--sub)" }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: "6px", background: "var(--glass2)", borderRadius: "8px", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                    style={{ height: "100%", borderRadius: "8px", background: colors[i] }}
                  />
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
