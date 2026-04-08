import type { Metadata } from "next";
import { NextAuthSessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://teammaker.lol";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "teammaker.lol — Balanced In-House Team Generator",
    template: "%s | teammaker.lol",
  },
  description:
    "Generate balanced League of Legends in-house teams. Role-aware, rank-aware, constraint-supported balancing for Discord communities and friend groups.",
  applicationName: "teammaker.lol",
  keywords: [
    "League of Legends",
    "team generator",
    "in-house",
    "scrim",
    "balanced teams",
    "LoL",
    "custom game",
    "내전",
    "팀 배정",
    "롤 내전",
  ],
  alternates: {
    canonical: APP_URL,
    languages: {
      "en": `${APP_URL}/en`,
      "ko": `${APP_URL}/ko`,
      "x-default": APP_URL,
    },
  },
  openGraph: {
    type: "website",
    siteName: "teammaker.lol",
    title: "teammaker.lol — Balanced In-House Team Generator",
    description:
      "Role-aware, rank-aware team balancing for League of Legends in-house games.",
    url: APP_URL,
    locale: "en_US",
    alternateLocale: ["ko_KR"],
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "teammaker.lol — Balanced In-House Team Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "teammaker.lol — Balanced In-House Team Generator",
    description:
      "Role-aware, rank-aware team balancing for League of Legends in-house games.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
      </body>
    </html>
  );
}
