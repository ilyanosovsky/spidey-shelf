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
    <html lang="en">
      <body className={`${geist.variable} ${pressStart.variable} antialiased`}>{children}</body>
    </html>
  );
}
