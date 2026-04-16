// ═══════════════════════════════════════════════════════════
// App Layout — Authenticated Pages Wrapper
// ═══════════════════════════════════════════════════════════
// Wraps all authenticated pages with:
// - Navbar (desktop) + MobileNav (mobile)
// - PageTransition animation on every route change
// ═══════════════════════════════════════════════════════════

import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import PageTransition from "@/components/PageTransition";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Navbar />
      <div className="page-container">
        <PageTransition>
          {children}
        </PageTransition>
      </div>
      <MobileNav />
    </div>
  );
}
