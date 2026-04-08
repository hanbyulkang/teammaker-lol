import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClientLocaleProvider } from "@/components/LocaleProvider";
import enMessages from "@/messages/en.json";
import koMessages from "@/messages/ko.json";

const allMessages = { en: enMessages, ko: koMessages };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://teammaker.lol";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hero" });

  const isKo = locale === "ko";
  const ogLocale = isKo ? "ko_KR" : "en_US";
  const altLocale = isKo ? "en_US" : "ko_KR";
  const title = isKo
    ? "teammaker.lol — LoL 내전 팀 자동 배정"
    : "teammaker.lol — Balanced In-House Team Generator";
  const description = t("subtitle");

  return {
    title,
    description,
    alternates: {
      canonical: `${APP_URL}/${locale}`,
      languages: {
        en: `${APP_URL}/en`,
        ko: `${APP_URL}/ko`,
        "x-default": APP_URL,
      },
    },
    openGraph: {
      type: "website",
      siteName: "teammaker.lol",
      title,
      description,
      url: `${APP_URL}/${locale}`,
      locale: ogLocale,
      alternateLocale: [altLocale],
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "ko")) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <ClientLocaleProvider initialLocale={locale} allMessages={allMessages}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ClientLocaleProvider>
  );
}
