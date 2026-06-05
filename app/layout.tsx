import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import AuthNav from "@/components/AuthNav";
import PwaRegistration from "@/components/PwaRegistration";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "MISS'SING — Carte des artistes",
  description: "Explorez les artistes féminines et minorités de genre dans la musique à travers le monde.",
  applicationName: "MISS'SING",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MISS'SING",
    statusBarStyle: "black",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",   // iOS safe area support
  themeColor: "#0c0b16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full w-full">
      <body className={`${dmSans.className} h-full flex flex-col`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <PwaRegistration />
        <nav
          className="fixed top-0 left-0 right-0 z-50 border-b"
          style={{
            background: 'rgba(12,11,22,0.92)',
            backdropFilter: 'blur(14px)',
            borderColor: 'var(--border)',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <div className="max-w-6xl mx-auto px-2.5 sm:px-3 h-14 flex items-center justify-between gap-1.5 sm:gap-2 overflow-hidden">

            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-shrink-0">
              <Image
                src="/logo.jpg"
                alt="MISS'SING"
                width={34}
                height={34}
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

            <div className="flex gap-1.5 sm:gap-2 items-center flex-shrink-0 min-w-0">
              <Link href="/" className="nav-link text-sm font-medium hidden sm:block">Globe</Link>
              <AuthNav />
              <Link
                href="/proposer"
                className="tap-target text-sm font-semibold px-2.5 sm:px-3 py-2 rounded-full transition-all whitespace-nowrap flex items-center justify-center"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                + Proposer
              </Link>
            </div>
          </div>
        </nav>
        <div className="flex-1 flex flex-col relative" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}>{children}</div>
      </body>
    </html>
  );
}
