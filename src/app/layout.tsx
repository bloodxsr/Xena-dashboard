import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";

import CinematicNav from "@/components/CinematicNav";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "700"]
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-space-mono"
});

export const metadata: Metadata = {
  title: "Fluxer Security Deck",
  description: "TypeScript security dashboard for raid defense and verification workflows"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceMono.variable} antialiased`}>
        <CinematicNav />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
