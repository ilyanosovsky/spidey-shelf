import type { Metadata, Viewport } from "next";
import { Geist, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPIDEY SHELF",
  description:
    "Personal Funko Pop Spider-Man collection tracker. Check if Ilya already owns a figure before gifting one.",
};

export const viewport: Viewport = {
  themeColor: "#1b41c8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables belong on <html>, not on <body>: Tailwind emits the theme tokens
    // (`--font-pixel: var(--font-press-start), monospace`) into `:root`, and a custom
    // property that references an undefined variable computes to nothing there — so with the
    // classes one level lower BOTH webfonts silently fell back to the system stack.
    <html lang="en" className={`${geist.variable} ${pressStart.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
