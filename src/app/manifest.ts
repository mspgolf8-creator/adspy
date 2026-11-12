import type { MetadataRoute } from "next";

// Rend l'adspy installable comme une app dans Chrome (icône dans le Dock, fenêtre à part)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Adspy",
    short_name: "Adspy",
    description: "Espionnage de pubs Meta par catégorie",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d10",
    theme_color: "#0d0d10",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
