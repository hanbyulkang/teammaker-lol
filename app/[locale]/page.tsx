"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, X, RefreshCw, Share2, Check, ChevronDown } from "lucide-react";
import { cn, lobbyUrl } from "@/lib/utils";
import { PLATFORMS } from "@/lib/riot/constants";
import type { Platform, PlayerProfile, TeamGenerationResult } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlayerRow {
  id: string;
  name: string;
  tag: string;
  status: "idle" | "loading" | "ok" | "error";
  profile: PlayerProfile | null;
  errorMsg: string | null;
}

function makeRow(name = "", tag = ""): PlayerRow {
  return { id: uuidv4(), name, tag, status: "idle", profile: null, errorMsg: null };
}

const ROLE_KR: Record<string, string> = {
  TOP: "탑", JUNGLE: "정글", MID: "미드", ADC: "원딜", SUPPORT: "서폿",
};

const ROLE_COLOR: Record<string, string> = {
  TOP: "text-orange-400", JUNGLE: "text-emerald-400",
  MID: "text-blue-400", ADC: "text-pink-400", SUPPORT: "text-yellow-400",
};

const TIER_ABBR: Record<string, string> = {
  IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G",
  PLATINUM: "P", EMERALD: "E", DIAMOND: "D",
  MASTER: "M", GRANDMASTER: "GM", CHALLENGER: "C",
};

const TIER_COLOR: Record<string, string> = {
  IRON: "text-[#9e9083]", BRONZE: "text-[#cd7f32]", SILVER: "text-[#b8bac4]",
  GOLD: "text-[#f0c040]", PLATINUM: "text-[#4dd0dc]", EMERALD: "text-[#50c878]",
  DIAMOND: "text-[#90d8f0]", MASTER: "text-[#c084fc]",
  GRANDMASTER: "text-[#f87171]", CHALLENGER: "text-[#f0c040]",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [rows, setRows] = useState<PlayerRow[]>(() => Array.from({ length: 10 }, () => makeRow()));
  const [platform, setPlatform] = useState<Platform>("kr");
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [result, setResult] = useState<TeamGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Paste handler: fill multiple rows at once ──────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
      const text = e.clipboardData.getData("text");
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return; // single line — normal paste

      e.preventDefault();
      setRows((prev) => {
        const next = [...prev];
        lines.forEach((line, offset) => {
          const idx = startIndex + offset;
          if (idx >= next.length) return;
          const hashIdx = line.lastIndexOf("#");
          if (hashIdx > 0 && hashIdx < line.length - 1) {
            next[idx] = {
              ...next[idx],
              name: line.slice(0, hashIdx).trim(),
              tag: line.slice(hashIdx + 1).trim(),
              status: "idle", profile: null, errorMsg: null,
            };
          } else {
            next[idx] = {
              ...next[idx],
              name: line,
              tag: next[idx].tag,
              status: "idle", profile: null, errorMsg: null,
            };
          }
        });
        return next;
      });
    },
    []
  );

  const updateRow = (id: string, patch: Partial<PlayerRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    setResult(null);

    // Validate
    const invalid = rows.filter((r) => !r.name.trim() || !r.tag.trim());
    if (invalid.length > 0) {
      setGenerateError(`${invalid.length}명의 이름 또는 태그가 비어있습니다.`);
      return;
    }

    setRows((prev) => prev.map((r) => ({ ...r, status: "loading", profile: null, errorMsg: null })));
    setIsGenerating(true);

    // Fetch profiles
    let profiles: PlayerProfile[] = [];
    try {
      const res = await fetch("/api/riot/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          players: rows.map((r) => ({ gameName: r.name.trim(), tagLine: r.tag.trim() })),
        }),
      });
      const data = await res.json();

      profiles = data.players ?? [];
      const errors: { riotId: string; message: string }[] = data.errors ?? [];

      // Build a lookup by gameName#tagLine
      const profileMap = new Map<string, PlayerProfile>();
      for (const p of profiles) {
        profileMap.set(`${p.gameName.toLowerCase()}#${p.tagLine.toLowerCase()}`, p);
      }

      setRows((prev) =>
        prev.map((row) => {
          const key = `${row.name.trim().toLowerCase()}#${row.tag.trim().toLowerCase()}`;
          const found = profileMap.get(key);
          const err = errors.find((e) => e.riotId.toLowerCase() === key);
          if (found) return { ...row, status: "ok", profile: found, errorMsg: null };
          if (err) return { ...row, status: "error", errorMsg: err.message };
          return { ...row, status: "error", errorMsg: "정보를 찾을 수 없습니다" };
        })
      );

      if (profiles.length !== 10) {
        setGenerateError(`${10 - profiles.length}명의 정보를 찾을 수 없습니다. 이름을 확인해주세요.`);
        setIsGenerating(false);
        return;
      }
    } catch {
      setGenerateError("네트워크 오류가 발생했습니다.");
      setRows((prev) => prev.map((r) => ({ ...r, status: "error", errorMsg: "오류" })));
      setIsGenerating(false);
      return;
    }

    // Create lobby
    let finalLobbyId = lobbyId;
    try {
      const lr = await fetch("/api/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          players: profiles.map((p) => ({ puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine })),
        }),
      });
      if (lr.ok) {
        finalLobbyId = (await lr.json()).lobbyId;
        setLobbyId(finalLobbyId);
      }
    } catch { /* non-fatal */ }

    // Generate
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
  }, [rows, platform, lobbyId]);

  const handleShare = async () => {
    const url = lobbyId ? lobbyUrl(lobbyId) : window.location.href;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allFilled = rows.every((r) => r.name.trim() && r.tag.trim());

  return (
    <div className="min-h-[calc(100vh-49px)]" style={{ background: "hsl(224,20%,8%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Server selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">서버</label>
          <div className="relative">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-md border border-border bg-card text-sm font-medium text-foreground cursor-pointer outline-none focus:border-primary/60 transition-colors"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value} style={{ background: "hsl(224,22%,11%)" }}>
                  {p.flag} {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Player input table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "hsl(224,22%,11%)",
            border: "1px solid hsl(224,16%,18%)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}
        >
          {/* Table header */}
          <div
            className="grid items-center px-4 py-2.5"
            style={{
              gridTemplateColumns: "28px 1fr 8px 80px 24px",
              gap: "8px",
              borderBottom: "1px solid hsl(224,16%,16%)",
              background: "hsl(224,22%,9%)",
            }}
          >
            <span className="text-[11px] font-semibold text-muted-foreground/60">#</span>
            <span className="text-[11px] font-semibold text-muted-foreground/60">소환사명</span>
            <span />
            <span className="text-[11px] font-semibold text-muted-foreground/60">태그</span>
            <span />
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <PlayerInputRow
              key={row.id}
              index={i}
              row={row}
              isLast={i === rows.length - 1}
              onChange={(patch) => updateRow(row.id, patch)}
              onPaste={(e) => handlePaste(e, i)}
            />
          ))}
        </div>

        {/* Error */}
        {generateError && (
          <div
            className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-red-300"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <X className="h-4 w-4 mt-0.5 shrink-0" />
            {generateError}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !allFilled}
          className={cn(
            "w-full py-3.5 rounded-xl font-bold text-[15px] tracking-wide transition-all duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            !isGenerating && allFilled
              ? "text-[#1a1208] shadow-lg active:scale-[0.99]"
              : "text-foreground/40 bg-card border border-border"
          )}
          style={
            !isGenerating && allFilled
              ? { background: "linear-gradient(135deg, #c8952a 0%, #e8b840 100%)", boxShadow: "0 4px 20px rgba(200,149,42,0.3)" }
              : {}
          }
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              플레이어 정보 불러오는 중...
            </span>
          ) : (
            "팀 생성"
          )}
        </button>

        {/* Result */}
        {result && (
          <ResultPanel
            result={result}
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
  index, row, isLast, onChange, onPaste,
}: {
  index: number;
  row: PlayerRow;
  isLast: boolean;
  onChange: (p: Partial<PlayerRow>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      className="input-row grid items-center px-4 transition-colors"
      style={{
        gridTemplateColumns: "28px 1fr 8px 80px 24px",
        gap: "8px",
        borderBottom: isLast ? "none" : "1px solid hsl(224,16%,15%)",
        minHeight: "44px",
      }}
    >
      {/* Index */}
      <span className="text-[12px] text-muted-foreground/40 font-mono select-none tabular-nums">
        {index + 1}
      </span>

      {/* Name */}
      <input
        type="text"
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value, status: "idle", profile: null, errorMsg: null })}
        onPaste={onPaste}
        placeholder="소환사 이름"
        className={cn(
          "bg-transparent text-[13px] outline-none w-full placeholder:text-muted-foreground/30 py-2",
          row.status === "error" && "text-red-400",
          row.status === "ok" && "text-foreground"
        )}
      />

      {/* # separator */}
      <span className="text-muted-foreground/40 text-[13px] select-none text-center">#</span>

      {/* Tag */}
      <input
        type="text"
        value={row.tag}
        onChange={(e) => onChange({ tag: e.target.value, status: "idle", profile: null, errorMsg: null })}
        placeholder="KR1"
        className={cn(
          "bg-transparent text-[13px] outline-none w-full placeholder:text-muted-foreground/30 py-2",
          row.status === "error" && "text-red-400",
          row.status === "ok" && "text-foreground"
        )}
      />

      {/* Status */}
      <div className="flex flex-col items-center justify-center gap-0.5">
        {row.status === "loading" && (
          <Loader2 className="h-3 w-3 text-muted-foreground/50 animate-spin" />
        )}
        {row.status === "ok" && row.profile && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {row.profile.soloRanked && (
              <span className={cn("text-[9px] font-bold leading-none", TIER_COLOR[row.profile.soloRanked.tier])}>
                {TIER_ABBR[row.profile.soloRanked.tier]}{row.profile.soloRanked.rank}
              </span>
            )}
          </div>
        )}
        {row.status === "error" && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-[9px] text-red-400 leading-none whitespace-nowrap">없음</span>
          </div>
        )}
        {row.status === "idle" && (row.name || row.tag) && (
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
        )}
      </div>
    </div>
  );
}

// ─── Result Panel ──────────────────────────────────────────────────────────────

function ResultPanel({ result, copied, onShare, onRegenerate, isRegenerating }: {
  result: TeamGenerationResult;
  copied: boolean;
  onShare: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const { teamA, teamB, balanceScore, strengthGap, offRoleCount, explanation } = result;

  const scoreColor =
    balanceScore >= 80 ? "#22c55e" :
    balanceScore >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-4 fade-in">

      {/* Score bar */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>
              {balanceScore}
            </span>
            <div>
              <p className="text-sm font-semibold">밸런스 점수</p>
              <p className="text-xs text-muted-foreground">
                전력 차이 {Math.round(strengthGap)}pt
                {offRoleCount > 0 && ` · 오프롤 ${offRoleCount}명`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              style={{ background: "hsl(224,18%,16%)", border: "1px solid hsl(224,16%,22%)" }}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
              재생성
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              style={{ background: "hsl(224,18%,16%)", border: "1px solid hsl(224,16%,22%)" }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? "복사됨" : "공유"}
            </button>
          </div>
        </div>

        {/* Strength bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>팀 A · {Math.round(teamA.totalStrength)}</span>
            <span>팀 B · {Math.round(teamB.totalStrength)}</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(224,18%,16%)" }}>
            {(() => {
              const total = teamA.totalStrength + teamB.totalStrength || 1;
              const aW = (teamA.totalStrength / total) * 100;
              return (
                <>
                  <div className="transition-all duration-700" style={{ width: `${aW}%`, background: "#3b82f6" }} />
                  <div className="flex-1" style={{ background: "#ef4444" }} />
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-3">
        <TeamCard title="팀 A" composition={teamA} side="A" />
        <TeamCard title="팀 B" composition={teamB} side="B" />
      </div>

      {/* Why */}
      <div
        className="rounded-xl px-5 py-4 space-y-2"
        style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
      >
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">분석</p>
        {explanation.map((line, i) => (
          <p key={i} className="text-[12px] text-muted-foreground leading-relaxed">
            · {line}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({ title, composition, side }: {
  title: string;
  composition: TeamGenerationResult["teamA"];
  side: "A" | "B";
}) {
  const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  const sorted = [...composition.roleAssignments].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );

  return (
    <div
      className={cn("rounded-xl overflow-hidden", side === "A" ? "team-a-top" : "team-b-top")}
      style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid hsl(224,16%,16%)" }}
      >
        <span className={cn("font-bold text-sm", side === "A" ? "text-blue-400" : "text-red-400")}>
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {Math.round(composition.totalStrength)}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "hsl(224,16%,15%)" }}>
        {sorted.map((asgn) => {
          const player = composition.players.find((p) => p.puuid === asgn.puuid);
          if (!player) return null;
          const tier = player.soloRanked?.tier;

          return (
            <div key={asgn.puuid} className="flex items-center gap-2.5 px-4 py-2.5">
              <span className={cn("text-[11px] font-bold w-7 shrink-0", ROLE_COLOR[asgn.role])}>
                {ROLE_KR[asgn.role]}
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                {player.gameName}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {tier && (
                  <span className={cn("text-[10px] font-bold", TIER_COLOR[tier])}>
                    {TIER_ABBR[tier]}{player.soloRanked?.rank}
                  </span>
                )}
                {asgn.isOffRole && (
                  <span
                    className="text-[9px] font-bold px-1 py-0.5 rounded"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                  >
                    오프롤
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
