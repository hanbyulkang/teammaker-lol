"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { LogIn, LogOut, Loader2 } from "lucide-react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-7 w-7 flex items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ""}
            width={26}
            height={26}
            className="rounded-full ring-1 ring-border"
          />
        ) : (
          <div
            className="h-[26px] w-[26px] rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: "rgba(200,149,42,0.2)", color: "#c8952a" }}
          >
            {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          title="로그아웃"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2.5 py-1 hover:border-border/80"
    >
      <LogIn className="h-3.5 w-3.5" />
      <span>로그인</span>
    </button>
  );
}
