// ═══════════════════════════════════════════════════════════
// Root Layout — Application Shell
// ═══════════════════════════════════════════════════════════
// Top-level layout wrapping the entire app with:
// - ThemeProvider (dark/light mode)
// - Sonner Toaster (toast notifications)
// - Ambient background effects
// - Global CSS + metadata
// ═══════════════════════════════════════════════════════════

import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster } from "sonner";

// SEO metadata
export const metadata: Metadata = {
  title: "MyAIJobHunt",
  description: "AI-powered career command center. Scan jobs, get AI match scores, and generate cover notes.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {/* Ambient glow circles */}
          <div className="amb">
            <div className="amb-c a1"></div>
            <div className="amb-c a2"></div>
            <div className="amb-c a3"></div>
            <div className="amb-c a4"></div>
          </div>

          {/* Grain texture overlay */}
          <div className="grain"></div>

          {/* Sonner toast notifications — positioned top-right */}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                fontFamily: "var(--font-body)",
              }
            }}
          />

          {/* Page content */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
