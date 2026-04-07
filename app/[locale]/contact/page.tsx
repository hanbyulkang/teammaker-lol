import { getTranslations } from "next-intl/server";
import { Mail, Bug, Lightbulb, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return { title: t("title") };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");
  const email =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@teammaker.lol";

  return (
    <div className="container max-w-2xl py-16 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Email section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            {t("email")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("emailDetail")}</p>
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
          >
            <Mail className="h-4 w-4" />
            {email}
          </a>
        </CardContent>
      </Card>

      {/* Bug reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4 text-red-400" />
            {t("bugTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("bugDetail")}</p>
        </CardContent>
      </Card>

      {/* Feature requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-yellow-400" />
            {t("featureTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("featureDetail")}</p>
        </CardContent>
      </Card>

      {/* Response time + note */}
      <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("responseTime")}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("note")}</p>
      </div>
    </div>
  );
}
