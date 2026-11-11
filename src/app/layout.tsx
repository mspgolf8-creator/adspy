import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "./sidebar";

export const metadata: Metadata = {
  title: "Adspy",
  description: "Espionnage de pubs Meta par catégorie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-[#0d0d10] text-zinc-100 antialiased">
        <Suspense>
          <Sidebar />
        </Suspense>
        <main className="px-4 py-6 lg:ml-60 lg:px-6">{children}</main>
      </body>
    </html>
  );
}
