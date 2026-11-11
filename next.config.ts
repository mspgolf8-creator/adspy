import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'app installée (scripts/web.sh) build dans .next-app pour ne pas déranger `npm run dev` (.next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
