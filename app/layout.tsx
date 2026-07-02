import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShelfWatch · Error Annotation Portal",
  description:
    "Visually inspect ShelfWatch recognition errors overlaid on shelf images.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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

        <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
            <Link href="/" className="group flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-[13px] font-bold text-white transition-transform duration-200 group-hover:rotate-[-6deg]">
                S
              </span>
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                  ParallelDots · ShelfWatch
                </span>
                <span className="block text-[15px] font-bold leading-tight text-ink">
                  Error Annotation Portal
                </span>
              </span>
            </Link>
            <div className="hidden items-center gap-4 text-[12px] text-mute sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-err-both" />
                WG+WC
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-err-group" />
                WG only
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-err-class" />
                WC only
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
