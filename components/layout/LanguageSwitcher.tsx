"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const next = locale === "en" ? "ko" : "en";
    // Swap locale prefix in path
    // en → no prefix; ko → /ko prefix
    let newPath: string;
    if (locale === "en") {
      // switching to ko: add /ko prefix
      newPath = `/ko${pathname}`;
    } else {
      // switching to en: strip /ko prefix
      newPath = pathname.replace(/^\/ko/, "") || "/";
    }
    router.push(newPath);
  };

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
