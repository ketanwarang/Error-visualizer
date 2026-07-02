import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SettingsProvider } from "@/components/SettingsContext";
import Logo from "@/components/Logo";
import SettingsPanel from "@/components/SettingsPanel";

export const metadata: Metadata = {
  title: "ShelfWatch · Error Annotation Portal",
  description:
    "Visually inspect ShelfWatch recognition errors overlaid on shelf images.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <SettingsProvider>
          <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
              <Link href="/" className="group flex items-center gap-3">
                <Logo />
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                    ParallelDots · ShelfWatch
                  </span>
                  <span className="block text-[15px] font-bold leading-tight text-ink">
                    Error Annotation Portal
                  </span>
                </span>
              </Link>
              <SettingsPanel />
            </div>
          </header>
          <main className="mx-auto max-w-[1440px] px-6 py-6">{children}</main>
        </SettingsProvider>
      </body>
    </html>
  );
}
