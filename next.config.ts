import type { NextConfig } from "next";

// Sites autorisés à afficher l'adspy dans une iframe (ex. le CRM interne), séparés par des espaces.
// Vide = n'importe quel site (l'accès reste protégé par le mot de passe).
const frameAncestors = process.env.ADSPY_FRAME_ANCESTORS?.trim() || "*";

const nextConfig: NextConfig = {
  // L'app installée (scripts/web.sh) build dans .next-app pour ne pas déranger `npm run dev` (.next)
  // Cache le rond « N » de Next.js (indicateur du mode test local, jamais visible en ligne)
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${frameAncestors}` }],
      },
    ];
  },
};

export default nextConfig;
