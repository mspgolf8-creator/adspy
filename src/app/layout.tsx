import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "./sidebar";
import { db, isConfigured } from "@/lib/supabase";
import type { Folder } from "./actions";

async function loadFolders(): Promise<Folder[]> {
  if (!isConfigured()) return [];
  try {
    const { data } = await db().from("folder_counts").select("id, name, n");
    return (data ?? []) as Folder[];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: "Adspy",
  description: "Espionnage de pubs Meta par catégorie",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique la largeur de la barre avant l'affichage (pas de saut) */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("adspy-sidebar")==="small")document.documentElement.dataset.sidebar="small"}catch(e){}` }} />
      </head>
      <body className="min-h-screen bg-[#0d0d10] text-zinc-100 antialiased">
        <Suspense>
          <Sidebar folders={await loadFolders()} />
        </Suspense>
        <main className="px-4 py-6 lg:ml-[var(--sb)] transition-[margin] lg:px-6">{children}</main>
      </body>
    </html>
  );
}
