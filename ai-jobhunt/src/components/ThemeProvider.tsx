// ═══════════════════════════════════════════════════════════
// Theme Provider — Dark / Light Mode System
// ═══════════════════════════════════════════════════════════
// Uses next-themes to persist user's theme choice.
// Wraps the entire app to provide theme context.
// ═══════════════════════════════════════════════════════════

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="data-theme"     // Sets data-theme="dark" or "light" on <html>
      defaultTheme="dark"         // Start in dark mode
      enableSystem={true}         // Respect system preference
      disableTransitionOnChange={false} // Smooth transition when toggling
    >
      {children}
    </NextThemesProvider>
  );
}
