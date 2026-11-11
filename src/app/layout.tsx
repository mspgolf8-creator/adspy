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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Adspy<span className="text-blue-600">.</span>
            </Link>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">Pubs</Link>
            <Link href="/?saved=1" className="text-sm text-slate-500 hover:text-slate-900">Sauvegardées</Link>
            <Link href="/settings" className="ml-auto text-sm text-slate-500 hover:text-slate-900">Réglages</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
