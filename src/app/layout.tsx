import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adspy",
  description: "Espionnage de pubs Meta par catégorie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Adspy<span className="text-violet-400">.</span>
            </Link>
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100">Pubs</Link>
            <Link href="/?saved=1" className="text-sm text-zinc-400 hover:text-zinc-100">Sauvegardées</Link>
            <Link href="/settings" className="ml-auto text-sm text-zinc-400 hover:text-zinc-100">Réglages</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
