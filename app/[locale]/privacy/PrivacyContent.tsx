"use client";

import { useTranslations } from "next-intl";

export function PrivacyContent() {
  const t = useTranslations("privacy");
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@teammaker.lol";

  const sections = [
    { title: t("dataCollectedTitle"), body: t("dataCollectedBody") },
    { title: t("dataNot"), body: null },
    { title: t("dataUseTitle"), body: t("dataUseBody") },
    { title: t("cacheTitle"), body: t("cacheBody") },
    { title: t("thirdPartyTitle"), body: t("thirdPartyBody") },
    { title: t("cookiesTitle"), body: t("cookiesBody") },
    { title: t("rightsTitle"), body: t("rightsBody") },
    { title: t("contactTitle"), body: t("contactBody", { email }) },
  ];

  return (
    <div className="container max-w-2xl py-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lastUpdated")}</p>
      </div>

      <p className="text-muted-foreground leading-relaxed">{t("intro")}</p>

      {sections.map((section, i) => (
        <section key={i} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.body && (
            <div className="text-muted-foreground leading-relaxed text-sm whitespace-pre-line">
              {section.body}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
