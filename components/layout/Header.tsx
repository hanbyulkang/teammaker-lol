import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Swords } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-base tracking-tight hover:opacity-80 transition-opacity"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 border border-primary/30">
            <Swords className="h-4 w-4 text-primary" />
          </div>
          <span>
            teammaker
            <span className="text-primary">.lol</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
