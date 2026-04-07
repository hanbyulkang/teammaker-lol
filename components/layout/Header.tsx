import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  return (
    <header className="w-full border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-bold text-sm tracking-tight hover:opacity-80 transition-opacity">
          teammaker<span className="gold-text">.lol</span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
