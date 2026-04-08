"use client";

import { useTranslations } from "next-intl";
import { Shield, Code2, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LegalContent() {
  const t = useTranslations("legal");

  const sections = [
    { icon: Shield, title: t("riotTitle"), body: t("riotBody"), iconClass: "text-blue-400" },
    { icon: Code2, title: t("riotApiTitle"), body: t("riotApiBody"), iconClass: "text-green-400" },
    { icon: Code2, title: t("trademarkTitle"), body: t("trademarkBody"), iconClass: "text-amber-400" },
    { icon: Database, title: t("dataTitle"), body: t("dataBody"), iconClass: "text-purple-400" },
  ];

  return (
    <div className="container max-w-2xl py-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-200/80 leading-relaxed">
          teammaker.lol was created under Riot Games&apos; &ldquo;Legal Jibber Jabber&rdquo;
          policy using assets owned by Riot Games. Riot Games does not endorse
          or sponsor this project.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <section.icon className={`h-4 w-4 ${section.iconClass}`} />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {section.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
