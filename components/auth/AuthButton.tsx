"use client";

import { useSession, signIn, signOut } from "next-auth/react";
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
      <div className="flex items-center gap-1.5">
        <div
          className="h-[26px] w-[26px] rounded-md flex items-center justify-center text-[12px] font-black select-none"
          style={{ background: "rgba(200,149,42,0.15)", color: "#c8952a", border: "1px solid rgba(200,149,42,0.3)" }}
        >
          T
        </div>
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
