import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "teammaker.lol — Balanced In-House Team Generator",
    template: "%s | teammaker.lol",
  },
  description:
    "Generate balanced League of Legends in-house teams. Role-aware, rank-aware, constraint-supported balancing for Discord communities and friend groups.",
  keywords: [
    "League of Legends",
    "team generator",
    "in-house",
    "scrim",
    "balanced teams",
    "LoL",
    "custom game",
  ],
  openGraph: {
    type: "website",
    siteName: "teammaker.lol",
    title: "teammaker.lol — Balanced In-House Team Generator",
    description:
      "Role-aware, rank-aware team balancing for League of Legends in-house games.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://teammaker.lol",
  },
  twitter: {
    card: "summary",
    title: "teammaker.lol",
    description: "Balanced in-house team generation for League of Legends.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
