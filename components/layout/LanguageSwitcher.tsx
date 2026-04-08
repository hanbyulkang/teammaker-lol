"use client";

import { useLocaleSwitch } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocaleSwitch();

  const toggle = () => setLocale(locale === "en" ? "ko" : "en");

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn(
        "h-8 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground",
        className
      )}
      title={locale === "en" ? "한국어로 보기" : "View in English"}
    >
      <span className="text-sm">{locale === "en" ? "🇰🇷" : "🇺🇸"}</span>
      <span>{locale === "en" ? "한국어" : "English"}</span>
    </Button>
  );
}
