"use client";

import { useTranslations } from "next-intl";

export function TermsContent() {
  const t = useTranslations("terms");
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@teammaker.lol";

  const sections = [
    { title: t("acceptTitle"), body: t("acceptBody") },
    { title: t("serviceTitle"), body: t("serviceBody") },
    { title: t("useTitle"), body: t("useBody") },
    { title: t("accuracyTitle"), body: t("accuracyBody") },
    { title: t("liabilityTitle"), body: t("liabilityBody") },
    { title: t("riotTitle"), body: t("riotBody") },
    { title: t("changesTitle"), body: t("changesBody") },
    { title: t("contactTitle"), body: t("contactBody", { email }) },
  ];

  return (
    <div className="container max-w-2xl py-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lastUpdated")}</p>
      </div>

      {sections.map((section, i) => (
        <section key={i} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <div className="text-muted-foreground leading-relaxed text-sm whitespace-pre-line">
            {section.body}
          </div>
        </section>
      ))}
    </div>
  );
}
