import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header() {
  return (
    <header
      className="w-full sticky top-0 z-40"
      style={{
        background: "hsl(224,22%,9%)",
        borderBottom: "1px solid hsl(224,16%,16%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-bold text-[15px] tracking-tight hover:opacity-80 transition-opacity">
          teammaker<span className="gold">.lol</span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
