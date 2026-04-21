import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'mammoth'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion', 'sonner'],
  },
};

export default nextConfig;
