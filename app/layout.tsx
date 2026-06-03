import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "MISSING — Carte des artistes",
  description: "Explorez les artistes féminines et minorités de genre dans la musique à travers le monde.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",   // iOS safe area support
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full w-full">
      <body className={`${dmSans.className} h-full flex flex-col`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <nav className="fixed top-0 left-0 right-0 z-50 border-b" style={{ background: 'rgba(12,11,22,0.92)', backdropFilter: 'blur(14px)', borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-3 h-14 flex items-center justify-between gap-2">

            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-shrink-0">
              <Image
                src="/logo.jpg"
                alt="MISSING"
                width={36}
                height={36}
                priority
                style={{ borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
              />
              {/* Masqué sur très petit écran pour éviter l'overflow */}
              <span className="hidden xs:block sm:block" style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '0.05em',
                color: 'var(--text)',
                lineHeight: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                Miss&apos;sing
              </span>
            </Link>

            <div className="flex gap-2 items-center flex-shrink-0">
              <Link href="/" className="nav-link text-sm font-medium hidden sm:block">Globe</Link>
              <Link
                href="/proposer"
                className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                + Proposer
              </Link>
            </div>
          </div>
        </nav>
        <div className="pt-14 flex-1 flex flex-col relative">{children}</div>
      </body>
    </html>
  );
}
