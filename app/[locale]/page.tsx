"use client";

import { useState, useCallback } from "react";
import { Loader2, X, RefreshCw, Share2, Check } from "lucide-react";
import { cn, lobbyUrl } from "@/lib/utils";
import { PLATFORMS } from "@/lib/riot/constants";
import type { Platform, PlayerProfile, TeamConstraint, TeamGenerationResult, RoleAssignment } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlayerRow {
  id: string;
  name: string;   // "gameName#tagLine"
  platform: Platform;
  status: "idle" | "loading" | "ok" | "error";
  profile: PlayerProfile | null;
  errorMsg: string | null;
}

function makeRow(): PlayerRow {
  return { id: uuidv4(), name: "", platform: "kr", status: "idle", profile: null, errorMsg: null };
}

const ROLE_LABEL: Record<string, string> = {
  TOP: "탑", JUNGLE: "정글", MID: "미드", ADC: "원딜", SUPPORT: "서폿",
};

const ROLE_COLOR: Record<string, string> = {
  TOP: "text-orange-400",
  JUNGLE: "text-green-400",
  MID: "text-blue-400",
  ADC: "text-pink-400",
  SUPPORT: "text-yellow-400",
};

const TIER_COLOR: Record<string, string> = {
  IRON: "text-[#9e9083]", BRONZE: "text-[#b87333]", SILVER: "text-[#b0b2b8]",
  GOLD: "text-[#f0c040]", PLATINUM: "text-[#50c8d4]", EMERALD: "text-[#50c878]",
  DIAMOND: "text-[#90d8f0]", MASTER: "text-[#c084fc]",
  GRANDMASTER: "text-[#f87171]", CHALLENGER: "text-[#f0c040]",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [rows, setRows] = useState<PlayerRow[]>(() => Array.from({ length: 10 }, makeRow));
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [result, setResult] = useState<TeamGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Row helpers ────────────────────────────────────────────────────────────

  const updateRow = (id: string, patch: Partial<PlayerRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    setResult(null);

    // Validate all rows have input
    const filled = rows.filter((r) => r.name.trim());
    if (filled.length < 10) {
      setGenerateError(`10명을 모두 입력해주세요. (현재 ${filled.length}명)`);
      return;
    }

    // Step 1: Fetch all player profiles
    setRows((prev) => prev.map((r) => ({ ...r, status: "loading", profile: null, errorMsg: null })));
    setIsGenerating(true);

    // Group by platform for batch requests
    const playersByPlatform = new Map<Platform, { idx: number; gameName: string; tagLine: string }[]>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const raw = row.name.trim();
      const lastHash = raw.lastIndexOf("#");
      if (lastHash <= 0 || lastHash === raw.length - 1) {
        updateRow(row.id, { status: "error", errorMsg: "형식: 이름#태그" });
        setIsGenerating(false);
        setGenerateError("이름#태그 형식으로 입력해주세요.");
        return;
      }
      const gameName = raw.slice(0, lastHash).trim();
      const tagLine = raw.slice(lastHash + 1).trim();
      const arr = playersByPlatform.get(row.platform) ?? [];
      arr.push({ idx: i, gameName, tagLine });
      playersByPlatform.set(row.platform, arr);
    }

    // Fetch per platform
    const profileMap = new Map<number, PlayerProfile>();
    const errorMap = new Map<number, string>();

    await Promise.all(
      Array.from(playersByPlatform.entries()).map(async ([platform, players]) => {
        try {
          const res = await fetch("/api/riot/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, players: players.map((p) => ({ gameName: p.gameName, tagLine: p.tagLine })) }),
          });
          const data = await res.json();

          // Map profiles back by index
          (data.players ?? []).forEach((profile: PlayerProfile, i: number) => {
            const original = players[i];
            if (original) profileMap.set(original.idx, profile);
          });

          (data.errors ?? []).forEach((e: { riotId: string; message: string }, i: number) => {
            // Match error back to original row
            const failed = players.find(
              (p) => `${p.gameName}#${p.tagLine}`.toLowerCase() === e.riotId.toLowerCase()
            );
            if (failed) errorMap.set(failed.idx, e.message);
          });
        } catch {
          players.forEach((p) => errorMap.set(p.idx, "네트워크 오류"));
        }
      })
    );

    // Update row statuses
    setRows((prev) =>
      prev.map((row, i) => {
        if (profileMap.has(i)) return { ...row, status: "ok", profile: profileMap.get(i)!, errorMsg: null };
        if (errorMap.has(i)) return { ...row, status: "error", errorMsg: errorMap.get(i)! };
        return { ...row, status: "error", errorMsg: "정보를 찾을 수 없습니다" };
      })
    );

    if (profileMap.size !== 10) {
      setGenerateError(`${10 - profileMap.size}명의 플레이어 정보를 찾을 수 없습니다. 확인 후 다시 시도해주세요.`);
      setIsGenerating(false);
      return;
    }

    const profiles = Array.from({ length: 10 }, (_, i) => profileMap.get(i)!);

    // Step 2: Create lobby
    let finalLobbyId = lobbyId;
    try {
      const lobbyRes = await fetch("/api/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: rows[0].platform,
          players: profiles.map((p) => ({ puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine })),
        }),
      });
      if (lobbyRes.ok) {
        const lobbyData = await lobbyRes.json();
        finalLobbyId = lobbyData.lobbyId;
        setLobbyId(finalLobbyId);
      }
    } catch {
      // non-fatal
    }

    // Step 3: Generate teams
    const genRes = await fetch(`/api/lobby/${finalLobbyId ?? "temp"}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ constraints: [], profiles }),
    });

    const genData = await genRes.json();
    setIsGenerating(false);

    if (!genRes.ok) {
      setGenerateError(genData.error ?? "팀 생성에 실패했습니다.");
      return;
    }

    setResult(genData.result);
  }, [rows, lobbyId]);

  const handleShare = async () => {
    const url = lobbyId ? lobbyUrl(lobbyId) : window.location.href;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allFilled = rows.every((r) => r.name.trim());
  const anyError = rows.some((r) => r.status === "error");

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold gold-text tracking-wide">팀 밸런싱</h1>
          <span className="text-xs text-muted-foreground">10명 입력 후 팀 생성</span>
        </div>

        {/* Player input table */}
        <div className="rounded-md border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[32px_1fr_100px_28px] gap-0 bg-[hsl(240,14%,9%)] border-b border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">#</span>
            <span className="text-[11px] text-muted-foreground">이름#태그</span>
            <span className="text-[11px] text-muted-foreground">서버</span>
            <span />
          </div>

          {rows.map((row, i) => (
            <PlayerInputRow
              key={row.id}
              index={i}
              row={row}
              onChange={(patch) => updateRow(row.id, patch)}
            />
          ))}
        </div>

        {/* Generate error */}
        {generateError && (
          <div className="rounded border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
            <X className="h-3.5 w-3.5 shrink-0" />
            {generateError}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !allFilled}
          className={cn(
            "w-full py-3 rounded font-bold text-sm transition-all",
            "bg-[hsl(40,70%,45%)] hover:bg-[hsl(40,70%,50%)] text-black",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            isGenerating && "cursor-wait"
          )}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              플레이어 정보 조회 중...
            </span>
          ) : (
            "팀 생성"
          )}
        </button>

        {/* Results */}
        {result && (
          <ResultPanel
            result={result}
            lobbyId={lobbyId}
            copied={copied}
            onShare={handleShare}
            onRegenerate={() => { setResult(null); handleGenerate(); }}
            isRegenerating={isGenerating}
          />
        )}
      </div>
    </div>
  );
}

// ─── Player Input Row ──────────────────────────────────────────────────────────

function PlayerInputRow({
  index,
  row,
  onChange,
}: {
  index: number;
  row: PlayerRow;
  onChange: (patch: Partial<PlayerRow>) => void;
}) {
  const isEven = index % 2 === 0;

  return (
    <div
      className={cn(
        "grid grid-cols-[32px_1fr_100px_28px] gap-0 items-center px-3 py-1.5 border-b border-border/50 last:border-b-0",
        isEven ? "bg-card" : "bg-[hsl(240,14%,7%)]"
      )}
    >
      {/* Index */}
      <span className="text-xs text-muted-foreground/60 font-mono">{index + 1}</span>

      {/* Name input */}
      <div className="pr-2">
        <input
          type="text"
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value, status: "idle", errorMsg: null, profile: null })}
          placeholder="이름#태그"
          className={cn(
            "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40",
            "focus:text-foreground",
            row.status === "error" && "text-red-400",
            row.status === "ok" && "text-green-400"
          )}
        />
        {row.status === "error" && row.errorMsg && (
          <p className="text-[10px] text-red-400 mt-0.5">{row.errorMsg}</p>
        )}
        {row.status === "ok" && row.profile && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {row.profile.soloRanked
              ? `${row.profile.soloRanked.tier} ${row.profile.soloRanked.rank}`
              : "언랭"}
            {" · "}
            {row.profile.primaryRole === "TOP" ? "탑"
              : row.profile.primaryRole === "JUNGLE" ? "정글"
              : row.profile.primaryRole === "MID" ? "미드"
              : row.profile.primaryRole === "ADC" ? "원딜"
              : "서폿"}
          </p>
        )}
      </div>

      {/* Server select */}
      <select
        value={row.platform}
        onChange={(e) => onChange({ platform: e.target.value as Platform })}
        className="bg-transparent text-xs text-muted-foreground outline-none cursor-pointer pr-1 w-full"
      >
        {PLATFORMS.map((p) => (
          <option key={p.value} value={p.value} className="bg-[#0d0d14] text-foreground">
            {p.flag} {p.value.toUpperCase()}
          </option>
        ))}
      </select>

      {/* Status dot */}
      <div className="flex justify-center">
        {row.status === "loading" && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />}
        {row.status === "ok" && <span className="h-2 w-2 rounded-full bg-green-500" />}
        {row.status === "error" && <span className="h-2 w-2 rounded-full bg-red-500" />}
        {row.status === "idle" && row.name && <span className="h-2 w-2 rounded-full bg-border" />}
      </div>
    </div>
  );
}

// ─── Result Panel ──────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  lobbyId,
  copied,
  onShare,
  onRegenerate,
  isRegenerating,
}: {
  result: TeamGenerationResult;
  lobbyId: string | null;
  copied: boolean;
  onShare: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const { teamA, teamB, balanceScore, strengthGap } = result;

  return (
    <div className="space-y-4 fade-in">
      {/* Balance summary */}
      <div className="flex items-center justify-between rounded border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "text-lg font-bold tabular-nums",
              balanceScore >= 80 ? "text-green-400" : balanceScore >= 60 ? "text-yellow-400" : "text-red-400"
            )}
          >
            {balanceScore}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ 100</span>
          </div>
          <div>
            <p className="text-xs font-semibold">밸런스 점수</p>
            <p className="text-[11px] text-muted-foreground">전력 차: {Math.round(strengthGap)} pt</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", isRegenerating && "animate-spin")} />
            재생성
          </button>
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs hover:bg-accent transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Share2 className="h-3 w-3" />}
            {copied ? "복사됨" : "공유"}
          </button>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-4">
        <TeamCard title="팀 A" composition={teamA} side="A" />
        <TeamCard title="팀 B" composition={teamB} side="B" />
      </div>

      {/* Explanation */}
      <div className="rounded border border-border bg-card px-4 py-3 space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">분석</p>
        {result.explanation.map((line, i) => (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed">
            · {line}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({
  title,
  composition,
  side,
}: {
  title: string;
  composition: TeamGenerationResult["teamA"];
  side: "A" | "B";
}) {
  const sorted = [...composition.roleAssignments].sort((a, b) => {
    const order = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
    return order.indexOf(a.role) - order.indexOf(b.role);
  });

  return (
    <div className={cn("rounded border border-border bg-card overflow-hidden", side === "A" ? "team-a" : "team-b")}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className={cn("font-bold text-sm", side === "A" ? "text-blue-400" : "text-red-400")}>
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {Math.round(composition.totalStrength)} pt
        </span>
      </div>

      {/* Players */}
      <div className="divide-y divide-border/30">
        {sorted.map((assignment) => {
          const player = composition.players.find((p) => p.puuid === assignment.puuid);
          if (!player) return null;
          const tier = player.soloRanked?.tier ?? null;

          return (
            <div key={assignment.puuid} className="flex items-center gap-2 px-3 py-2">
              {/* Role badge */}
              <span className={cn("text-[11px] font-bold w-8 shrink-0", ROLE_COLOR[assignment.role])}>
                {ROLE_LABEL[assignment.role]}
              </span>

              {/* Name */}
              <span className="flex-1 text-xs font-medium truncate">
                {player.gameName}
                <span className="text-muted-foreground/50 font-normal text-[10px]">#{player.tagLine}</span>
              </span>

              {/* Tier */}
              {tier && (
                <span className={cn("text-[10px] font-bold shrink-0", TIER_COLOR[tier] ?? "text-muted-foreground")}>
                  {tier.slice(0, 1)}{player.soloRanked?.rank}
                </span>
              )}

              {/* Off-role indicator */}
              {assignment.isOffRole && (
                <span className="text-[9px] text-amber-500 shrink-0">오프</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
