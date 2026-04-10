import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { AuthButton } from "@/components/auth/AuthButton";

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
        <div className="flex items-center gap-3">
          <a
            href="https://banpick.lol"
            target="_blank"
            rel="noopener noreferrer"
            className="banpick-btn text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors"
          >
            밴픽하러 가기 →
          </a>
          <AuthButton />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
