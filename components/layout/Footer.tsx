import Link from "next/link";
import { useTranslations } from "next-intl";
import { Swords } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  const links = [
    { href: "/privacy", label: t("privacy") },
    { href: "/terms", label: t("terms") },
    { href: "/contact", label: t("contact") },
    { href: "/legal", label: t("legal") },
  ];

  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="container py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 border border-primary/30">
                <Swords className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>
                teammaker<span className="text-primary">.lol</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
              {t("tagline")}
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Links
            </p>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Notice
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("disclaimer")}
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <p className="text-[11px] text-muted-foreground">
            {t("copyright", { year })}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Not affiliated with or endorsed by Riot Games
          </p>
        </div>
      </div>
    </footer>
  );
}
