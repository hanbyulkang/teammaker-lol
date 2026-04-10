"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, X, RefreshCw, Share2, Check, ChevronDown, ArrowLeft, BookmarkPlus, Bookmark, Search, LogIn, Pencil, RotateCcw } from "lucide-react";
import { cn, lobbyUrl } from "@/lib/utils";
import { PLATFORMS } from "@/lib/riot/constants";
import { rankToScore } from "@/lib/analysis/rankMapping";
import { buildTeamComposition, computeBalanceScore, generateExplanation, swapRolesInTeam } from "@/lib/optimizer/scorer";
import type { Platform, PlayerProfile, TeamGenerationResult, Tier, Division, Role, RoleComfort, TeamConstraint, ConstraintType } from "@/types";
import { v4 as uuidv4 } from "uuid";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROLE_KR: Record<Role, string> = {
  TOP: "탑", JUNGLE: "정글", MID: "미드", ADC: "원딜", SUPPORT: "서폿",
};
const ROLE_COLOR: Record<Role, string> = {
  TOP: "text-orange-400", JUNGLE: "text-emerald-400",
  MID: "text-blue-400", ADC: "text-pink-400", SUPPORT: "text-yellow-400",
};
const TIER_ABBR: Record<Tier, string> = {
  IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G",
  PLATINUM: "P", EMERALD: "E", DIAMOND: "D",
  MASTER: "M", GRANDMASTER: "GM", CHALLENGER: "C",
};
const TIER_COLOR: Record<Tier, string> = {
  IRON: "text-[#9e9083]", BRONZE: "text-[#cd7f32]", SILVER: "text-[#b8bac4]",
  GOLD: "text-[#f0c040]", PLATINUM: "text-[#4dd0dc]", EMERALD: "text-[#50c878]",
  DIAMOND: "text-[#90d8f0]", MASTER: "text-[#c084fc]",
  GRANDMASTER: "text-[#f87171]", CHALLENGER: "text-[#f0c040]",
};
const TIER_KR: Record<Tier, string> = {
  IRON: "아이언", BRONZE: "브론즈", SILVER: "실버", GOLD: "골드",
  PLATINUM: "플래티넘", EMERALD: "에메랄드", DIAMOND: "다이아몬드",
  MASTER: "마스터", GRANDMASTER: "그랜드마스터", CHALLENGER: "챌린저",
};
const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const ALL_TIERS: Tier[] = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const ALL_DIVISIONS: Division[] = ["IV", "III", "II", "I"];
const APEX_TIERS: Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PlayerRow {
  id: string;
  name: string;
  tag: string;
  status: "idle" | "loading" | "ok" | "error";
  profile: PlayerProfile | null;
  errorMsg: string | null;
}

interface ReviewEntry {
  gameName: string;
  tagLine: string;
  profile: PlayerProfile | null;
  isManual: boolean;
  // Editable fields — pre-filled from API, or filled manually
  tier: Tier | "";
  division: Division;
  primaryRoles: Role[];   // 1-tap: primary (+200 bonus)
  secondaryRoles: Role[]; // 2-tap: secondary (+80 bonus)
}

interface SavedPlayerEntry {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string;
  primaryRoles: Role[];
  secondaryRoles: Role[];
  tier: Tier | "";
  division: Division;
  rawProfileData?: unknown;
}

interface EditPlayerForm {
  puuid: string | null;
  gameName: string;
  tagLine: string;
  platform: Platform;
  primaryRoles: Role[];
  secondaryRoles: Role[];
  tier: Tier | "";
  division: Division;
}

function makeRow(name = "", tag = ""): PlayerRow {
  return { id: uuidv4(), name, tag, status: "idle", profile: null, errorMsg: null };
}

// ─── Manual profile builder ────────────────────────────────────────────────────

function buildManualProfile(
  gameName: string, tagLine: string, platform: Platform,
  tier: Tier | "", division: Division,
  primaryRoles: Role[], secondaryRoles: Role[],
): PlayerProfile {
  const baseSkill = tier ? rankToScore(tier, APEX_TIERS.includes(tier as Tier) ? null : division, 50) : 0;
  const allSelected = [...primaryRoles, ...secondaryRoles];
  const primaryRole = primaryRoles[0] ?? secondaryRoles[0] ?? "MID";
  const secondaryRole = primaryRoles[1] ?? secondaryRoles[0] ?? primaryRole;
  const bonus = (role: Role) => {
    if (primaryRoles.includes(role)) return 200;
    if (secondaryRoles.includes(role)) return 80;
    return -150;
  };
  const roleComfort: RoleComfort[] = ALL_ROLES.map((role) => ({
    role,
    frequency: allSelected.includes(role) ? 1 / Math.max(allSelected.length, 1) : 0.05,
    score: Math.max(0, baseSkill + (allSelected.length ? bonus(role) : 0)),
  }));
  return {
    puuid: `manual-${uuidv4()}`,
    gameName,
    tagLine,
    platform,
    soloRanked: tier
      ? { queueType: "RANKED_SOLO_5x5", tier: tier as Tier, rank: division, leaguePoints: 50, wins: 0, losses: 0 }
      : null,
    flexRanked: null,
    baseSkill,
    primaryRole,
    secondaryRole,
    roleComfort,
    recentMatches: [],
    topChampions: [],
    championConcentration: 0,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Step = "input" | "review" | "result";

export default function HomePage() {
  const tInput = useTranslations("input");
  const tReview = useTranslations("review");
  const tGenerate = useTranslations("generate");
  const tErrors = useTranslations("errors");
  const tSave = useTranslations("save");

  const { data: session } = useSession();

  const [step, setStep] = useState<Step>("input");
  const [rows, setRows] = useState<PlayerRow[]>(() => Array.from({ length: 10 }, () => makeRow()));
  const [platform, setPlatform] = useState<Platform>("kr");
  const [reviewEntries, setReviewEntries] = useState<ReviewEntry[]>([]);
  const [constraints, setConstraints] = useState<TeamConstraint[]>([]);
  const [result, setResult] = useState<TeamGenerationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Saved players
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayerEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [playerSearch, setPlayerSearch] = useState("");
  const [isManaging, setIsManaging] = useState(false);
  const [editPlayerForm, setEditPlayerForm] = useState<EditPlayerForm | null>(null);
  const [editPlayerLoading, setEditPlayerLoading] = useState(false);
  const [editPlayerError, setEditPlayerError] = useState<string | null>(null);

  // ── Paste handler ─────────────────────────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
      const text = e.clipboardData.getData("text");
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      e.preventDefault();
      setRows((prev) => {
        const next = [...prev];
        lines.forEach((line, offset) => {
          const idx = startIndex + offset;
          if (idx >= next.length) return;
          const hashIdx = line.lastIndexOf("#");
          if (hashIdx > 0 && hashIdx < line.length - 1) {
            next[idx] = { ...next[idx], name: line.slice(0, hashIdx).trim(), tag: line.slice(hashIdx + 1).trim(), status: "idle", profile: null, errorMsg: null };
          } else {
            next[idx] = { ...next[idx], name: line, status: "idle", profile: null, errorMsg: null };
          }
        });
        return next;
      });
    },
    []
  );

  const updateRow = (id: string, patch: Partial<PlayerRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ── Step 1: Resolve players ───────────────────────────────────────────────

  const handleResolve = useCallback(async () => {
    setError(null);
    const invalid = rows.filter((r) => !r.name.trim() || !r.tag.trim());
    if (invalid.length > 0) {
      setError(tErrors("emptyFields", { count: invalid.length }));
      return;
    }

    setRows((prev) => prev.map((r) => ({ ...r, status: "loading", profile: null, errorMsg: null })));
    setIsLoading(true);

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

      const profiles: PlayerProfile[] = data.players ?? [];
      const errors: { riotId: string; message: string }[] = data.errors ?? [];

      const profileMap = new Map<string, PlayerProfile>();
      for (const p of profiles) {
        profileMap.set(`${p.gameName.toLowerCase()}#${p.tagLine.toLowerCase()}`, p);
      }

      // Build row statuses
      const updatedRows = rows.map((row) => {
        const key = `${row.name.trim().toLowerCase()}#${row.tag.trim().toLowerCase()}`;
        const found = profileMap.get(key);
        const err = errors.find((e) => e.riotId.toLowerCase() === key);
        if (found) return { ...row, status: "ok" as const, profile: found, errorMsg: null };
        if (err) return { ...row, status: "error" as const, errorMsg: err.message };
        return { ...row, status: "error" as const, errorMsg: "정보를 찾을 수 없습니다" };
      });
      setRows(updatedRows);

      // Build review entries — restore saved role selections if available
      const entries: ReviewEntry[] = updatedRows.map((row) => {
        if (row.profile) {
          const p = row.profile;
          const saved = savedPlayers.find((s) => s.puuid === p.puuid);
          return {
            gameName: row.name.trim(),
            tagLine: row.tag.trim(),
            profile: p,
            isManual: false,
            tier: saved?.tier !== undefined && saved.tier !== "" ? saved.tier : ((p.soloRanked ?? p.flexRanked)?.tier ?? ""),
            division: saved?.division ?? (((p.soloRanked ?? p.flexRanked)?.rank ?? "IV") as Division),
            primaryRoles: saved?.primaryRoles ?? [],
            secondaryRoles: saved?.secondaryRoles ?? [],
          };
        }
        return {
          gameName: row.name.trim(),
          tagLine: row.tag.trim(),
          profile: null,
          isManual: true,
          tier: "", division: "IV",
          primaryRoles: [],
          secondaryRoles: [],
        };
      });

      setReviewEntries(entries);

      // Check for API key errors
      const hasApiError = errors.some((e) => e.message.includes("401") || e.message.includes("403"));
      if (hasApiError) {
        setError(tErrors("apiKeyExpired"));
      }

      setStep("review");
    } catch {
      setError(tErrors("networkError"));
      setRows((prev) => prev.map((r) => ({ ...r, status: "error" as const, errorMsg: "오류" })));
    } finally {
      setIsLoading(false);
    }
  }, [rows, platform, savedPlayers]);

  // ── Step 2: Generate teams from review ───────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setError(null);
    setErrorDetails(null);

    // ── Client-side constraint pre-validation ─────────────────────────────
    if (constraints.length > 0) {
      // Build name lookup by puuid
      const nameOf = (puuid: string) => {
        const e = reviewEntries.find((e) => (e.profile?.puuid ?? `manual-${e.gameName}#${e.tagLine}`) === puuid);
        return e?.gameName ?? puuid.slice(0, 8);
      };

      // Check: same pair in both TOGETHER and OPPOSITE
      for (const c of constraints) {
        if (c.type !== "TOGETHER") continue;
        const conflict = constraints.find(
          (o) => o.type === "OPPOSITE" &&
            ((o.puuidA === c.puuidA && o.puuidB === c.puuidB) ||
             (o.puuidA === c.puuidB && o.puuidB === c.puuidA))
        );
        if (conflict) {
          setError(tErrors("constraintConflict", { a: nameOf(c.puuidA), b: nameOf(c.puuidB) }));
          return;
        }
      }

      // Check: TOGETHER group exceeds 5
      const parent = new Map<string, string>();
      const find = (x: string): string => {
        if (!parent.has(x)) parent.set(x, x);
        if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
        return parent.get(x)!;
      };
      for (const c of constraints) {
        if (c.type !== "TOGETHER") continue;
        const ra = find(c.puuidA), rb = find(c.puuidB);
        if (ra !== rb) parent.set(rb, ra);
      }
      const groups = new Map<string, string[]>();
      for (const e of reviewEntries) {
        const key = e.profile?.puuid ?? `manual-${e.gameName}#${e.tagLine}`;
        const root = find(key);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root)!.push(e.gameName);
      }
      for (const members of groups.values()) {
        if (members.length > 5) {
          setError(tErrors("constraintGroupTooLarge", { count: members.length, names: members.join(", ") }));
          return;
        }
      }
    }

    // Validate: every player must have at least one primary role
    const missingPrimary = reviewEntries.filter((e) => e.primaryRoles.length === 0);
    if (missingPrimary.length > 0) {
      const names = missingPrimary.map((e) => e.gameName).join(", ");
      const hasOnlySecondary = missingPrimary.some((e) => e.secondaryRoles.length > 0);
      if (hasOnlySecondary) {
        setError(tErrors("missingPrimaryWithSecondary", { names }));
      } else {
        setError(tErrors("missingPrimary", { names }));
      }
      return;
    }

    setIsLoading(true);

    // Build final profiles — use review entry's tier + role selections
    const profiles: PlayerProfile[] = reviewEntries.map((entry) => {
      const { primaryRoles, secondaryRoles } = entry;
      const allSelected = [...primaryRoles, ...secondaryRoles];
      const primary: Role = primaryRoles[0] ?? "MID";
      const secondary: Role = primaryRoles[1] ?? secondaryRoles[0] ?? primary;
      const bonus = (role: Role) => {
        if (primaryRoles.includes(role)) return 200;
        if (secondaryRoles.includes(role)) return 80;
        return -150;
      };

      if (entry.profile) {
        const baseSkill = entry.tier
          ? rankToScore(entry.tier as Tier, APEX_TIERS.includes(entry.tier as Tier) ? null : entry.division, 50)
          : entry.profile.baseSkill;

        const roleComfort: RoleComfort[] = ALL_ROLES.map((role) => ({
          role,
          frequency: allSelected.length ? (allSelected.includes(role) ? 1 / allSelected.length : 0.05) : 0.2,
          score: Math.max(0, baseSkill + (allSelected.length ? bonus(role) : 0)),
        }));

        const soloRanked = entry.tier
          ? { queueType: "RANKED_SOLO_5x5" as const, tier: entry.tier as Tier, rank: APEX_TIERS.includes(entry.tier as Tier) ? ("I" as Division) : entry.division, leaguePoints: 50, wins: entry.profile.soloRanked?.wins ?? 0, losses: entry.profile.soloRanked?.losses ?? 0 }
          : entry.profile.soloRanked;

        return { ...entry.profile, primaryRole: primary, secondaryRole: secondary, roleComfort, baseSkill, soloRanked };
      }
      return buildManualProfile(entry.gameName, entry.tagLine, platform, entry.tier, entry.division, primaryRoles, secondaryRoles);
    });

    // Create lobby (best effort)
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
    try {
      const genRes = await fetch(`/api/lobby/${finalLobbyId ?? "temp"}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constraints, profiles }),
      });
      const genData = await genRes.json();

      if (!genRes.ok) {
        setError(genData.error ?? tErrors("optimizerFailed"));
        if (genData.details?.length) setErrorDetails(genData.details);
        return;
      }
      setResult(genData.result);
      setStep("result");
    } catch {
      setError(tErrors("serverError"));
    } finally {
      setIsLoading(false);
    }
  }, [reviewEntries, platform, lobbyId]);

  const handleShare = async () => {
    const url = lobbyId ? lobbyUrl(lobbyId) : window.location.href;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load saved players when session is available
  useEffect(() => {
    if (!session?.user) { setSavedPlayers([]); return; }
    fetch("/api/saved-players")
      .then((r) => r.json())
      .then((data) => {
        type RawSaved = { puuid: string; gameName: string; tagLine: string; platform: string; profileData?: { _primaryRoles?: Role[]; _secondaryRoles?: Role[]; _tier?: Tier | ""; _division?: Division; soloRanked?: { tier?: Tier; rank?: string } } };
        const players = (data.players ?? []).map((p: RawSaved) => ({
          puuid: p.puuid,
          gameName: p.gameName,
          tagLine: p.tagLine,
          platform: p.platform,
          primaryRoles: p.profileData?._primaryRoles ?? [],
          secondaryRoles: p.profileData?._secondaryRoles ?? [],
          tier: p.profileData?._tier ?? (p.profileData?.soloRanked?.tier ?? "") as Tier | "",
          division: (p.profileData?._division ?? "IV") as Division,
          rawProfileData: p.profileData as unknown,
        }));
        setSavedPlayers(players);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Save current reviewEntries profiles to the user's account
  const handleSaveTeam = useCallback(async () => {
    if (!session?.user) return;
    setSaveStatus("saving");
    try {
      const players = reviewEntries
        .filter((e) => e.profile && !e.profile.puuid.startsWith("manual-"))
        .map((e) => ({
          puuid: e.profile!.puuid,
          gameName: e.profile!.gameName,
          tagLine: e.profile!.tagLine,
          platform: e.profile!.platform,
          profileData: {
            ...(e.profile! as unknown as Record<string, unknown>),
            _primaryRoles: e.primaryRoles,
            _secondaryRoles: e.secondaryRoles,
            _tier: e.tier,
            _division: e.division,
          },
        }));
      if (players.length === 0) return;
      await fetch("/api/saved-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players }),
      });
      // Refresh saved players list
      const updated = await fetch("/api/saved-players").then((r) => r.json());
      setSavedPlayers(updated.players ?? []);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  }, [reviewEntries, session?.user]);

  // Fill an empty row with a saved player
  const fillRowFromSaved = useCallback((sp: SavedPlayerEntry) => {
    const emptyIdx = rows.findIndex((r) => !r.name.trim() && !r.tag.trim());
    const targetIdx = emptyIdx >= 0 ? emptyIdx : rows.findIndex((r) => !r.name.trim() || !r.tag.trim());
    if (targetIdx < 0) return;
    setRows((prev) =>
      prev.map((r, i) =>
        i === targetIdx ? { ...r, name: sp.gameName, tag: sp.tagLine, status: "idle", profile: null, errorMsg: null } : r
      )
    );
  }, [rows]);

  const handleDeleteSaved = useCallback(async (puuid: string) => {
    setSavedPlayers((prev) => prev.filter((p) => p.puuid !== puuid));
    try {
      await fetch(`/api/saved-players/${puuid}`, { method: "DELETE" });
    } catch { /* non-fatal */ }
  }, []);

  const openAddPlayerForm = useCallback(() => {
    setEditPlayerForm({ puuid: null, gameName: "", tagLine: "", platform: "kr", primaryRoles: [], secondaryRoles: [], tier: "", division: "IV" });
    setEditPlayerError(null);
  }, []);

  const openEditPlayerForm = useCallback((sp: SavedPlayerEntry) => {
    setEditPlayerForm({
      puuid: sp.puuid,
      gameName: sp.gameName,
      tagLine: sp.tagLine,
      platform: sp.platform as Platform,
      primaryRoles: sp.primaryRoles,
      secondaryRoles: sp.secondaryRoles,
      tier: sp.tier,
      division: sp.division,
    });
    setEditPlayerError(null);
  }, []);

  const handleEditFormRoleToggle = useCallback((role: Role) => {
    setEditPlayerForm((prev) => {
      if (!prev) return prev;
      const isPrimary = prev.primaryRoles.includes(role);
      const isSecondary = prev.secondaryRoles.includes(role);
      if (!isPrimary && !isSecondary) {
        return { ...prev, primaryRoles: [...prev.primaryRoles, role] };
      } else if (isPrimary) {
        return { ...prev, primaryRoles: prev.primaryRoles.filter((r) => r !== role), secondaryRoles: [...prev.secondaryRoles, role] };
      } else {
        return { ...prev, secondaryRoles: prev.secondaryRoles.filter((r) => r !== role) };
      }
    });
  }, []);

  const handleSaveEditedPlayer = useCallback(async () => {
    if (!editPlayerForm) return;
    setEditPlayerLoading(true);
    setEditPlayerError(null);
    try {
      let profileData: Record<string, unknown>;
      if (editPlayerForm.puuid) {
        // Editing existing — merge role/tier changes into existing rawProfileData
        const existing = savedPlayers.find((sp) => sp.puuid === editPlayerForm.puuid);
        profileData = {
          ...((existing?.rawProfileData as Record<string, unknown>) ?? {}),
          _primaryRoles: editPlayerForm.primaryRoles,
          _secondaryRoles: editPlayerForm.secondaryRoles,
          _tier: editPlayerForm.tier,
          _division: editPlayerForm.division,
        };
        await fetch("/api/saved-players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: [{
              puuid: editPlayerForm.puuid,
              gameName: editPlayerForm.gameName,
              tagLine: editPlayerForm.tagLine,
              platform: editPlayerForm.platform,
              profileData,
            }],
          }),
        });
        setSavedPlayers((prev) => prev.map((sp) =>
          sp.puuid === editPlayerForm.puuid
            ? { ...sp, gameName: editPlayerForm.gameName, tagLine: editPlayerForm.tagLine, platform: editPlayerForm.platform, primaryRoles: editPlayerForm.primaryRoles, secondaryRoles: editPlayerForm.secondaryRoles, tier: editPlayerForm.tier, division: editPlayerForm.division, rawProfileData: profileData }
            : sp
        ));
      } else {
        // Adding new — build a manual profile
        const manualProfile = buildManualProfile(
          editPlayerForm.gameName, editPlayerForm.tagLine, editPlayerForm.platform,
          editPlayerForm.tier, editPlayerForm.division,
          editPlayerForm.primaryRoles, editPlayerForm.secondaryRoles,
        );
        profileData = {
          ...(manualProfile as unknown as Record<string, unknown>),
          _primaryRoles: editPlayerForm.primaryRoles,
          _secondaryRoles: editPlayerForm.secondaryRoles,
          _tier: editPlayerForm.tier,
          _division: editPlayerForm.division,
        };
        const newPuuid = `manual-${editPlayerForm.gameName}-${editPlayerForm.tagLine}-${editPlayerForm.platform}`;
        await fetch("/api/saved-players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: [{
              puuid: newPuuid,
              gameName: editPlayerForm.gameName,
              tagLine: editPlayerForm.tagLine,
              platform: editPlayerForm.platform,
              profileData,
            }],
          }),
        });
        setSavedPlayers((prev) => [...prev, {
          puuid: newPuuid,
          gameName: editPlayerForm.gameName,
          tagLine: editPlayerForm.tagLine,
          platform: editPlayerForm.platform,
          primaryRoles: editPlayerForm.primaryRoles,
          secondaryRoles: editPlayerForm.secondaryRoles,
          tier: editPlayerForm.tier,
          division: editPlayerForm.division,
          rawProfileData: profileData,
        }]);
      }
      setEditPlayerForm(null);
    } catch {
      setEditPlayerError("저장 중 오류가 발생했습니다.");
    } finally {
      setEditPlayerLoading(false);
    }
  }, [editPlayerForm, savedPlayers]);

  const allFilled = rows.every((r) => r.name.trim() && r.tag.trim());

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-49px)]" style={{ background: "hsl(224,20%,8%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* ── INPUT STEP ── */}
        {step === "input" && (
          <>
            {/* Saved players panel */}
            {session?.user ? (
              <div
                className="rounded-xl p-3 space-y-2"
                style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground/70 flex items-center gap-1.5">
                    <Bookmark className="h-3 w-3" />
                    {tSave("savedPlayersLabel")}
                  </span>
                  <div className="flex items-center gap-2">
                    {!isManaging && savedPlayers.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                        <input
                          type="text"
                          placeholder={tSave("searchPlaceholder")}
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          className="pl-6 pr-2 py-1 text-[11px] rounded-md bg-black/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 outline-none w-28"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => { setIsManaging((v) => !v); setPlayerSearch(""); setEditPlayerForm(null); }}
                      className={cn(
                        "text-[11px] font-medium px-2 py-1 rounded-md border transition-colors",
                        isManaging
                          ? "border-primary/40 text-primary bg-primary/5"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      {isManaging ? "완료" : "관리"}
                    </button>
                  </div>
                </div>
                {savedPlayers.length === 0 && !isManaging && (
                  <p className="text-[11px] text-muted-foreground/40 py-1">저장된 플레이어가 없습니다.</p>
                )}
                {(savedPlayers.length > 0 || isManaging) && (
                  <div className="flex flex-wrap gap-1.5">
                    {savedPlayers
                      .filter((sp) =>
                        isManaging || !playerSearch ||
                        `${sp.gameName}#${sp.tagLine}`.toLowerCase().includes(playerSearch.toLowerCase())
                      )
                      .map((sp) => {
                        const isEditing = editPlayerForm?.puuid === sp.puuid;
                        const alreadyAdded = !isManaging && rows.some(
                          (r) => r.name.toLowerCase() === sp.gameName.toLowerCase() && r.tag.toLowerCase() === sp.tagLine.toLowerCase()
                        );
                        return isManaging ? (
                          <div
                            key={sp.puuid}
                            className={cn(
                              "flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer",
                              isEditing
                                ? "border-primary/50 bg-primary/10 text-foreground"
                                : "border-border/50 hover:border-border hover:bg-white/5"
                            )}
                            style={isEditing ? {} : { background: "rgba(255,255,255,0.03)" }}
                            onClick={() => isEditing ? setEditPlayerForm(null) : openEditPlayerForm(sp)}
                          >
                            <span className="text-foreground/70">{sp.gameName}</span>
                            <span className="text-muted-foreground/40">#{sp.tagLine}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteSaved(sp.puuid); if (isEditing) setEditPlayerForm(null); }}
                              className="ml-1 h-4 w-4 rounded flex items-center justify-center text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            key={sp.puuid}
                            onClick={() => !alreadyAdded && fillRowFromSaved(sp)}
                            disabled={alreadyAdded}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all",
                              alreadyAdded
                                ? "opacity-40 cursor-not-allowed border-border/30 text-muted-foreground"
                                : "border-border/60 text-foreground/80 hover:border-primary/40 hover:text-foreground hover:bg-primary/5 cursor-pointer"
                            )}
                            style={{ background: "rgba(255,255,255,0.03)" }}
                          >
                            <span>{sp.gameName}</span>
                            <span className="text-muted-foreground/50">#{sp.tagLine}</span>
                            {!alreadyAdded && <span className="text-primary/70 ml-0.5">+</span>}
                          </button>
                        );
                      })}
                    {isManaging && (
                      <button
                        onClick={() => editPlayerForm?.puuid === null ? setEditPlayerForm(null) : openAddPlayerForm()}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors",
                          editPlayerForm?.puuid === null
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-dashed border-border/50 text-muted-foreground/60 hover:border-primary/40 hover:text-primary/80"
                        )}
                        style={{ background: editPlayerForm?.puuid === null ? undefined : "rgba(255,255,255,0.02)" }}
                      >
                        <span className="text-lg leading-none pb-0.5">+</span>
                        <span>추가</span>
                      </button>
                    )}
                  </div>
                )}
                {/* Inline edit/add form */}
                {isManaging && editPlayerForm && (
                  <div className="mt-2 pt-2 border-t border-border/30 space-y-2">
                    {editPlayerForm.puuid === null && (
                      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                        <input
                          type="text"
                          placeholder="게임 이름"
                          value={editPlayerForm.gameName}
                          onChange={(e) => setEditPlayerForm((f) => f && { ...f, gameName: e.target.value })}
                          className="px-2 py-1 text-[11px] rounded-md bg-black/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="태그"
                          value={editPlayerForm.tagLine}
                          onChange={(e) => setEditPlayerForm((f) => f && { ...f, tagLine: e.target.value })}
                          className="px-2 py-1 text-[11px] rounded-md bg-black/20 border border-border/50 text-foreground placeholder:text-muted-foreground/40 outline-none w-16"
                        />
                        <select
                          value={editPlayerForm.platform}
                          onChange={(e) => setEditPlayerForm((f) => f && { ...f, platform: e.target.value as Platform })}
                          className="px-1.5 py-1 text-[11px] rounded-md bg-black/20 border border-border/50 text-foreground outline-none"
                        >
                          {(["kr","na","euw","eune","jp","br","lan","las","oce","tr","ru"] as Platform[]).map((p) => (
                            <option key={p} value={p}>{p.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-1.5">
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground/50 mb-0.5">포지션</div>
                        <div className="flex items-center gap-1">
                          {ALL_ROLES.map((role) => {
                            const isPrimary = editPlayerForm.primaryRoles.includes(role);
                            const isSecondary = editPlayerForm.secondaryRoles.includes(role);
                            return (
                              <button
                                key={role}
                                onClick={() => handleEditFormRoleToggle(role)}
                                className="flex items-center justify-center rounded transition-all duration-100 active:scale-90"
                                style={{
                                  width: 30,
                                  height: 30,
                                  background: isPrimary
                                    ? "rgba(200,149,42,0.22)"
                                    : isSecondary
                                    ? "rgba(59,130,246,0.18)"
                                    : "rgba(255,255,255,0.04)",
                                  border: isPrimary
                                    ? "1px solid rgba(200,149,42,0.65)"
                                    : isSecondary
                                    ? "1px solid rgba(96,165,250,0.7)"
                                    : "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <img
                                  src={ROLE_ICON[role]}
                                  alt={ROLE_KR[role]}
                                  width={16}
                                  height={16}
                                  style={{
                                    opacity: isPrimary ? 1 : isSecondary ? 0.9 : 0.22,
                                    filter: isPrimary
                                      ? "brightness(0) saturate(100%) invert(75%) sepia(60%) saturate(500%) hue-rotate(5deg)"
                                      : isSecondary
                                      ? "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(190deg)"
                                      : "brightness(0) invert(1)",
                                  }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] text-muted-foreground/50 mb-0.5">티어</div>
                        <div className="flex gap-1 items-center">
                          <select
                            value={editPlayerForm.tier}
                            onChange={(e) => setEditPlayerForm((f) => f && { ...f, tier: e.target.value as Tier | "" })}
                            className="px-1.5 py-0.5 text-[11px] rounded-md bg-black/20 border border-border/50 text-foreground outline-none"
                          >
                            <option value="">-</option>
                            {ALL_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {editPlayerForm.tier && !APEX_TIERS.includes(editPlayerForm.tier as Tier) && (
                            <select
                              value={editPlayerForm.division}
                              onChange={(e) => setEditPlayerForm((f) => f && { ...f, division: e.target.value as Division })}
                              className="px-1.5 py-0.5 text-[11px] rounded-md bg-black/20 border border-border/50 text-foreground outline-none w-14"
                            >
                              {ALL_DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                    {editPlayerError && (
                      <p className="text-[11px] text-red-400">{editPlayerError}</p>
                    )}
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => setEditPlayerForm(null)}
                        className="px-2.5 py-1 text-[11px] rounded-md border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveEditedPlayer}
                        disabled={editPlayerLoading || (!editPlayerForm.puuid && (!editPlayerForm.gameName.trim() || !editPlayerForm.tagLine.trim()))}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-primary/80 hover:bg-primary text-white font-medium transition-colors disabled:opacity-50"
                      >
                        {editPlayerLoading ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
              >
                <span className="text-[12px] text-muted-foreground">
                  {tSave("loginPromptInput")}
                </span>
                <button
                  onClick={() => signIn("google")}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {tSave("loginButton")}
                </button>
              </div>
            )}

            {/* Server selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{tInput("server")}</label>
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
                <span className="text-[11px] font-semibold text-muted-foreground/60">{tInput("summonerName")}</span>
                <span />
                <span className="text-[11px] font-semibold text-muted-foreground/60">{tInput("tag")}</span>
                <span />
              </div>

              {rows.map((row, i) => (
                <PlayerInputRow
                  key={row.id}
                  index={i}
                  row={row}
                  isLast={i === rows.length - 1}
                  onChange={(patch) => updateRow(row.id, patch)}
                  onPaste={(e) => handlePaste(e, i)}
                  onClear={() => updateRow(row.id, { name: "", tag: "", status: "idle", profile: null, errorMsg: null })}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-red-300"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <X className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Resolve button */}
            <button
              onClick={handleResolve}
              disabled={isLoading || !allFilled}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-[15px] tracking-wide transition-all duration-150",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                !isLoading && allFilled
                  ? "text-[#1a1208] shadow-lg active:scale-[0.99]"
                  : "text-foreground/40 bg-card border border-border"
              )}
              style={
                !isLoading && allFilled
                  ? { background: "linear-gradient(135deg, #c8952a 0%, #e8b840 100%)", boxShadow: "0 4px 20px rgba(200,149,42,0.3)" }
                  : {}
              }
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tInput("loadingPlayers")}
                </span>
              ) : (
                tInput("loadButton")
              )}
            </button>
          </>
        )}

        {/* ── REVIEW STEP ── */}
        {step === "review" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep("input"); setError(null); setErrorDetails(null); setConstraints([]); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {tReview("back")}
              </button>
              <span className="text-xs text-muted-foreground">
                {tReview("autoVerified", { n: reviewEntries.filter((e) => !e.isManual).length })}
              </span>
            </div>

            {/* Review table */}
            <ReviewPanel
              entries={reviewEntries}
              constraints={constraints}
              onConstraintsChange={setConstraints}
              onChange={(i, patch) =>
                setReviewEntries((prev) =>
                  prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
                )
              }
            />

            {/* Error */}
            {error && (
              <div
                className="flex flex-col gap-1.5 rounded-lg px-4 py-3 text-sm text-red-300"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <div className="flex items-start gap-2.5">
                  <X className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                {errorDetails && errorDetails.length > 0 && (
                  <ul className="pl-6 space-y-0.5 text-[12px] text-red-300/70">
                    {errorDetails.map((d, i) => <li key={i}>· {d}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-[15px] tracking-wide transition-all duration-150",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                !isLoading
                  ? "text-[#1a1208] shadow-lg active:scale-[0.99]"
                  : "text-foreground/40 bg-card border border-border"
              )}
              style={
                !isLoading
                  ? { background: "linear-gradient(135deg, #c8952a 0%, #e8b840 100%)", boxShadow: "0 4px 20px rgba(200,149,42,0.3)" }
                  : {}
              }
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tReview("generating")}
                </span>
              ) : (
                tReview("generateButton")
              )}
            </button>
          </>
        )}

        {/* ── RESULT STEP ── */}
        {step === "result" && result && (
          <>
            <button
              onClick={() => { setStep("review"); setResult(null); setError(null); setErrorDetails(null); setSaveStatus("idle"); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {tReview("backToReview")}
            </button>
            <ResultPanel
              result={result}
              copied={copied}
              onShare={handleShare}
              onRegenerate={handleGenerate}
              isRegenerating={isLoading}
              onResultEdit={(edited) => setResult(edited)}
            />
            {/* Save prompt */}
            {session?.user ? (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
              >
                <div className="flex items-center gap-2">
                  <BookmarkPlus className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                  <span className="text-[13px] text-muted-foreground">
                    {saveStatus === "saved"
                      ? tSave("savePromptSaved")
                      : tSave("savePromptQuestion")}
                  </span>
                </div>
                {saveStatus !== "saved" && (
                  <button
                    onClick={handleSaveTeam}
                    disabled={saveStatus === "saving"}
                    className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    style={{ background: "rgba(200,149,42,0.15)", color: "#c8952a", border: "1px solid rgba(200,149,42,0.3)" }}
                  >
                    {saveStatus === "saving" ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> {tSave("saving")}</>
                    ) : (
                      <><Check className="h-3 w-3" /> {tSave("save")}</>
                    )}
                  </button>
                )}
                {saveStatus === "saved" && (
                  <Check className="h-4 w-4 shrink-0" style={{ color: "#c8952a" }} />
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
              >
                <div className="flex items-center gap-2">
                  <BookmarkPlus className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span className="text-[13px] text-muted-foreground">
                    {tSave("loginPromptResult")}
                  </span>
                </div>
                <button
                  onClick={() => signIn("google")}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 whitespace-nowrap transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {tSave("loginButtonShort")}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ─── Player Input Row ──────────────────────────────────────────────────────────

function PlayerInputRow({
  index, row, isLast, onChange, onPaste, onClear,
}: {
  index: number;
  row: PlayerRow;
  isLast: boolean;
  onChange: (p: Partial<PlayerRow>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const tInput = useTranslations("input");
  const hasContent = !!(row.name || row.tag);
  return (
    <div
      className="input-row grid items-center px-4 transition-colors group"
      style={{
        gridTemplateColumns: "28px 1fr 8px 80px 32px",
        gap: "8px",
        borderBottom: isLast ? "none" : "1px solid hsl(224,16%,15%)",
        minHeight: "44px",
      }}
    >
      <span className="text-[12px] text-muted-foreground/40 font-mono select-none tabular-nums">
        {index + 1}
      </span>
      <input
        type="text"
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value, status: "idle", profile: null, errorMsg: null })}
        onPaste={onPaste}
        placeholder={tInput("summonerName")}
        className={cn(
          "bg-transparent text-[13px] outline-none w-full placeholder:text-muted-foreground/30 py-2",
          row.status === "error" && "text-red-400",
        )}
      />
      <span className="text-muted-foreground/40 text-[13px] select-none text-center">#</span>
      <input
        type="text"
        value={row.tag}
        onChange={(e) => onChange({ tag: e.target.value, status: "idle", profile: null, errorMsg: null })}
        placeholder="KR1"
        className={cn(
          "bg-transparent text-[13px] outline-none w-full placeholder:text-muted-foreground/30 py-2",
          row.status === "error" && "text-red-400",
        )}
      />
      <div className="flex items-center justify-center">
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
          <div className="flex flex-col items-center gap-0.5" title={row.errorMsg ?? undefined}>
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-[9px] text-red-400 leading-none whitespace-nowrap">
              {row.errorMsg?.includes("401") || row.errorMsg?.includes("403") ? tInput("keyExpired") :
               row.errorMsg?.includes("429") ? tInput("rateLimitShort") : tInput("notFoundShort")}
            </span>
          </div>
        )}
        {row.status === "idle" && hasContent && (
          <button
            onClick={onClear}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
            tabIndex={-1}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {row.status === "idle" && !hasContent && (
          <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
        )}
      </div>
    </div>
  );
}

// ─── Role icon URLs (CommunityDragon) ─────────────────────────────────────────

const ROLE_ICON: Record<Role, string> = {
  TOP:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-top.svg",
  JUNGLE:  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-jungle.svg",
  MID:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-middle.svg",
  ADC:     "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-bottom.svg",
  SUPPORT: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-utility.svg",
};

// ─── Review Panel ──────────────────────────────────────────────────────────────

function ReviewPanel({
  entries, constraints, onConstraintsChange, onChange,
}: {
  entries: ReviewEntry[];
  constraints: TeamConstraint[];
  onConstraintsChange: (c: TeamConstraint[]) => void;
  onChange: (i: number, patch: Partial<ReviewEntry>) => void;
}) {
  const tReview = useTranslations("review");
  const tConstraint = useTranslations("constraint");
  const tPH = useTranslations("positionHelp");
  const [newType, setNewType] = useState<ConstraintType>("TOGETHER");
  const [showHelp, setShowHelp] = useState(false);
  const [newA, setNewA] = useState<string>("");
  const [newB, setNewB] = useState<string>("");

  // Use puuid (or manual-id) as key; fall back to index string for unresolved entries
  const entryKey = (e: ReviewEntry) => e.profile?.puuid ?? `manual-${e.gameName}#${e.tagLine}`;

  const addConstraint = () => {
    if (!newA || !newB || newA === newB) return;
    // Prevent duplicate
    const exists = constraints.some(
      (c) => (c.puuidA === newA && c.puuidB === newB) || (c.puuidA === newB && c.puuidB === newA)
    );
    if (exists) return;
    onConstraintsChange([
      ...constraints,
      { id: uuidv4(), type: newType, puuidA: newA, puuidB: newB },
    ]);
    setNewA("");
    setNewB("");
  };

  const removeConstraint = (id: string) =>
    onConstraintsChange(constraints.filter((c) => c.id !== id));

  const nameOf = (puuid: string) => {
    const e = entries.find((e) => entryKey(e) === puuid);
    return e ? e.gameName : puuid.slice(0, 8);
  };

  return (
    <div className="space-y-3 fade-in">
      {/* Player table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "hsl(224,22%,11%)",
          border: "1px solid hsl(224,16%,18%)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        <div
          className="grid items-center px-4 py-2.5"
          style={{
            gridTemplateColumns: "24px 1fr 88px 1fr",
            gap: "8px",
            borderBottom: "1px solid hsl(224,16%,16%)",
            background: "hsl(224,22%,9%)",
          }}
        >
          <span />
          <span className="text-[11px] font-semibold text-muted-foreground/60">{tReview("summonerCol")}</span>
          <span className="text-[11px] font-semibold text-muted-foreground/60">{tReview("tierCol")}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground/60">{tReview("positionCol")}</span>
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              style={{ width: 15, height: 15, border: "1px solid currentColor", fontSize: 9, lineHeight: 1 }}
              title="포지션 입력 방법"
            >
              ?
            </button>
          </div>
        </div>

        {/* Help modal */}
        {showHelp && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowHelp(false)}
          >
            <div
              className="rounded-2xl p-6 max-w-sm w-full space-y-4"
              style={{ background: "hsl(224,22%,12%)", border: "1px solid hsl(224,16%,22%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-[15px]">{tPH("title")}</p>
                <button onClick={() => setShowHelp(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-[13px] text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 h-4 w-4 rounded" style={{ background: "rgba(200,149,42,0.22)", border: "1px solid rgba(200,149,42,0.65)" }} />
                  <div><span className="text-foreground font-semibold">{tPH("primaryLabel")}</span><br />{tPH("primaryDesc")}</div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 h-4 w-4 rounded" style={{ background: "rgba(59,130,246,0.18)", border: "1px solid rgba(96,165,250,0.7)" }} />
                  <div><span className="text-foreground font-semibold">{tPH("secondaryLabel")}</span><br />{tPH("secondaryDesc")}</div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 h-4 w-4 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                  <div><span className="text-foreground font-semibold">{tPH("deselectLabel")}</span><br />{tPH("deselectDesc")}</div>
                </div>
              </div>

              <div
                className="rounded-lg px-3 py-2.5 text-[12px] text-amber-300/80 leading-relaxed"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                {tPH("warning")}
              </div>
            </div>
          </div>
        )}

        {entries.map((entry, i) => (
          <ReviewRow
            key={i}
            index={i}
            entry={entry}
            isLast={i === entries.length - 1}
            onChange={(patch) => onChange(i, patch)}
          />
        ))}
      </div>

      {/* Constraint editor */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "hsl(224,22%,11%)",
          border: "1px solid hsl(224,16%,18%)",
        }}
      >
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{ borderBottom: "1px solid hsl(224,16%,16%)", background: "hsl(224,22%,9%)" }}
        >
          <span className="text-[11px] font-semibold text-muted-foreground/60">{tConstraint("constraintSectionTitle")}</span>
          <span className="text-[10px] text-muted-foreground/35">{tConstraint("optional")}</span>
        </div>

        {/* Active constraints */}
        {constraints.length > 0 && (
          <div className="px-4 py-2 space-y-1.5" style={{ borderBottom: "1px solid hsl(224,16%,15%)" }}>
            {constraints.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-[12px]">
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={
                    c.type === "TOGETHER"
                      ? { background: "rgba(34,197,94,0.12)", color: "#4ade80" }
                      : { background: "rgba(239,68,68,0.12)", color: "#f87171" }
                  }
                >
                  {c.type === "TOGETHER" ? tConstraint("togetherShort") : tConstraint("oppositeShort")}
                </span>
                <span className="font-medium truncate max-w-[90px]">{nameOf(c.puuidA)}</span>
                <span className="text-muted-foreground/40">↔</span>
                <span className="font-medium truncate max-w-[90px]">{nameOf(c.puuidB)}</span>
                <button
                  onClick={() => removeConstraint(c.id)}
                  className="ml-auto shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add constraint row */}
        <div className="px-4 py-3 flex items-center gap-2">
          {/* Type toggle */}
          <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid hsl(224,16%,22%)" }}>
            {(["TOGETHER", "OPPOSITE"] as ConstraintType[]).map((t) => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className="px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={
                  newType === t
                    ? t === "TOGETHER"
                      ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
                      : { background: "rgba(239,68,68,0.15)", color: "#f87171" }
                    : { background: "transparent", color: "hsl(224,12%,45%)" }
                }
              >
                {t === "TOGETHER" ? tConstraint("togetherShort") : tConstraint("oppositeShort")}
              </button>
            ))}
          </div>

          {/* Player A */}
          <div className="relative flex-1 min-w-0">
            <select
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              className="w-full appearance-none bg-transparent text-[12px] font-medium outline-none cursor-pointer py-1 pr-5 truncate"
              style={{
                border: "1px solid hsl(224,16%,22%)",
                borderRadius: "6px",
                padding: "4px 20px 4px 8px",
                background: "hsl(224,20%,9%)",
                color: newA ? "hsl(220,20%,92%)" : "hsl(224,12%,40%)",
              }}
            >
              <option value="" style={{ background: "hsl(224,22%,11%)" }}>{tConstraint("selectPlayer")}</option>
              {entries.map((e) => {
                const key = entryKey(e);
                return (
                  <option key={key} value={key} style={{ background: "hsl(224,22%,11%)" }}>
                    {e.gameName}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
          </div>

          <span className="text-muted-foreground/40 text-[11px] shrink-0">↔</span>

          {/* Player B */}
          <div className="relative flex-1 min-w-0">
            <select
              value={newB}
              onChange={(e) => setNewB(e.target.value)}
              className="w-full appearance-none bg-transparent text-[12px] font-medium outline-none cursor-pointer"
              style={{
                border: "1px solid hsl(224,16%,22%)",
                borderRadius: "6px",
                padding: "4px 20px 4px 8px",
                background: "hsl(224,20%,9%)",
                color: newB ? "hsl(220,20%,92%)" : "hsl(224,12%,40%)",
              }}
            >
              <option value="" style={{ background: "hsl(224,22%,11%)" }}>{tConstraint("selectPlayer")}</option>
              {entries.map((e) => {
                const key = entryKey(e);
                return (
                  <option key={key} value={key} disabled={key === newA} style={{ background: "hsl(224,22%,11%)" }}>
                    {e.gameName}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
          </div>

          {/* Add button */}
          <button
            onClick={addConstraint}
            disabled={!newA || !newB || newA === newB}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: newA && newB && newA !== newB ? "rgba(200,149,42,0.15)" : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(200,149,42,0.35)",
              color: "#c8952a",
            }}
          >
            {tConstraint("addButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline select style helper ─────────────────────────────────────────────────

const inlineSelectClass = cn(
  "appearance-none bg-transparent text-[12px] font-medium outline-none cursor-pointer",
  "border-b border-dashed border-muted-foreground/30 focus:border-primary/60",
  "py-0.5 pr-1 w-full text-center transition-colors"
);

function ReviewRow({
  index, entry, isLast, onChange,
}: {
  index: number;
  entry: ReviewEntry;
  isLast: boolean;
  onChange: (patch: Partial<ReviewEntry>) => void;
}) {
  const tTier = useTranslations("tier");
  const tResult = useTranslations("result");
  const isApex = entry.tier && APEX_TIERS.includes(entry.tier as Tier);

  // 3-state cycle: unselected → primary (gold) → secondary (silver) → unselected
  const handleRoleClick = (role: Role) => {
    if (entry.primaryRoles.includes(role)) {
      // primary → secondary
      onChange({
        primaryRoles: entry.primaryRoles.filter((r) => r !== role),
        secondaryRoles: [...entry.secondaryRoles, role],
      });
    } else if (entry.secondaryRoles.includes(role)) {
      // secondary → unselected
      onChange({
        secondaryRoles: entry.secondaryRoles.filter((r) => r !== role),
      });
    } else {
      // unselected → primary
      onChange({
        primaryRoles: [...entry.primaryRoles, role],
      });
    }
  };

  return (
    <div
      className="grid items-center px-4"
      style={{
        gridTemplateColumns: "24px 1fr 88px 1fr",
        gap: "8px",
        borderBottom: isLast ? "none" : "1px solid hsl(224,16%,15%)",
        minHeight: "50px",
        background: entry.isManual ? "rgba(245,158,11,0.03)" : "transparent",
      }}
    >
      {/* Status dot */}
      <div className="flex items-center">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", entry.isManual ? "bg-amber-500" : "bg-emerald-500")} />
      </div>

      {/* Name */}
      <div className="min-w-0">
        <p className={cn("text-[13px] font-medium truncate leading-tight", entry.isManual && "text-amber-400/90")}>
          {entry.gameName}
        </p>
        <p className="text-[10px] text-muted-foreground/50 leading-tight">#{entry.tagLine}</p>
      </div>

      {/* Tier */}
      <div className="flex items-center gap-0.5">
        <select
          value={entry.tier}
          onChange={(e) => onChange({ tier: e.target.value as Tier | "" })}
          className={cn(inlineSelectClass, entry.tier ? TIER_COLOR[entry.tier as Tier] : "text-muted-foreground/40")}
          style={{ background: "transparent", minWidth: 0 }}
        >
          <option value="" style={{ background: "hsl(224,22%,11%)" }}>{tTier("UNRANKED")}</option>
          {ALL_TIERS.map((tier) => (
            <option key={tier} value={tier} style={{ background: "hsl(224,22%,11%)" }}>{tTier(tier)}</option>
          ))}
        </select>
        {entry.tier && !isApex && (
          <select
            value={entry.division}
            onChange={(e) => onChange({ division: e.target.value as Division })}
            className={cn(inlineSelectClass, "w-7 shrink-0")}
            style={{ background: "transparent" }}
          >
            {ALL_DIVISIONS.map((d) => (
              <option key={d} value={d} style={{ background: "hsl(224,22%,11%)" }}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {/* Role buttons — tap1=primary(gold), tap2=secondary(silver), tap3=deselect */}
      <div className="flex items-center gap-1">
        {ALL_ROLES.map((role) => {
          const isPrimary = entry.primaryRoles.includes(role);
          const isSecondary = entry.secondaryRoles.includes(role);
          return (
            <button
              key={role}
              onClick={() => handleRoleClick(role)}
              title={`${tResult(`roles.${role}` as `roles.${Role}`)}${isPrimary ? " ★" : isSecondary ? " ☆" : ""}`}
              className="flex items-center justify-center rounded transition-all duration-100 active:scale-90"
              style={{
                width: 30,
                height: 30,
                background: isPrimary
                  ? "rgba(200,149,42,0.22)"
                  : isSecondary
                  ? "rgba(59,130,246,0.18)"
                  : "rgba(255,255,255,0.04)",
                border: isPrimary
                  ? "1px solid rgba(200,149,42,0.65)"
                  : isSecondary
                  ? "1px solid rgba(96,165,250,0.7)"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <img
                src={ROLE_ICON[role]}
                alt={ROLE_KR[role]}
                width={16}
                height={16}
                style={{
                  opacity: isPrimary ? 1 : isSecondary ? 0.9 : 0.22,
                  filter: isPrimary
                    ? "brightness(0) saturate(100%) invert(75%) sepia(60%) saturate(500%) hue-rotate(5deg)"
                    : isSecondary
                    ? "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(190deg)"
                    : "brightness(0) invert(1)",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result Panel ──────────────────────────────────────────────────────────────

function ResultPanel({ result, copied, onShare, onRegenerate, isRegenerating, onResultEdit }: {
  result: TeamGenerationResult;
  copied: boolean;
  onShare: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onResultEdit: (r: TeamGenerationResult) => void;
}) {
  const tResult = useTranslations("result");
  const tGenerate = useTranslations("generate");
  const tCommon = useTranslations("common");

  // ── Edit mode state ─────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editTeamA, setEditTeamA] = useState(result.teamA);
  const [editTeamB, setEditTeamB] = useState(result.teamB);
  const [selected, setSelected] = useState<{ puuid: string; team: "A" | "B" } | null>(null);

  const editGap = Math.abs(editTeamA.totalStrength - editTeamB.totalStrength);
  const editScore = computeBalanceScore(editTeamA.totalStrength, editTeamB.totalStrength);
  const editOffRoleCount = [...editTeamA.roleAssignments, ...editTeamB.roleAssignments].filter((a) => a.isOffRole).length;

  const startEdit = () => {
    setEditTeamA(result.teamA);
    setEditTeamB(result.teamB);
    setSelected(null);
    setIsEditing(true);
  };

  const resetEdit = () => {
    setEditTeamA(result.teamA);
    setEditTeamB(result.teamB);
    setSelected(null);
  };

  const confirmEdit = () => {
    const newExplanation = generateExplanation(editTeamA, editTeamB, editGap, editScore, editOffRoleCount);
    onResultEdit({
      ...result,
      teamA: editTeamA,
      teamB: editTeamB,
      strengthGap: Math.round(editGap),
      balanceScore: editScore,
      offRoleCount: editOffRoleCount,
      explanation: newExplanation,
    });
    setIsEditing(false);
    setSelected(null);
  };

  const handlePlayerClick = (puuid: string, team: "A" | "B") => {
    if (!selected) { setSelected({ puuid, team }); return; }
    if (selected.puuid === puuid) { setSelected(null); return; }

    if (selected.team === team) {
      // Same-team: swap role assignments between the two players
      if (team === "A") setEditTeamA(swapRolesInTeam(editTeamA, selected.puuid, puuid));
      else setEditTeamB(swapRolesInTeam(editTeamB, selected.puuid, puuid));
      setSelected(null);
      return;
    }

    // Cross-team swap: move players between teams, reoptimize roles for each
    const puuidA = selected.team === "A" ? selected.puuid : puuid;
    const puuidB = selected.team === "B" ? selected.puuid : puuid;
    const playerA = editTeamA.players.find((p) => p.puuid === puuidA)!;
    const playerB = editTeamB.players.find((p) => p.puuid === puuidB)!;
    setEditTeamA(buildTeamComposition([...editTeamA.players.filter((p) => p.puuid !== puuidA), playerB]));
    setEditTeamB(buildTeamComposition([...editTeamB.players.filter((p) => p.puuid !== puuidB), playerA]));
    setSelected(null);
  };

  // ── Display values (edit mode or normal) ────────────────────────────────────
  const { teamA, teamB, balanceScore, strengthGap, offRoleCount, explanation } = result;
  const dispScore = isEditing ? editScore : balanceScore;
  const dispGap   = isEditing ? Math.round(editGap) : Math.round(strengthGap);
  const dispOff   = isEditing ? editOffRoleCount : offRoleCount;
  const dispA     = isEditing ? editTeamA : teamA;
  const dispB     = isEditing ? editTeamB : teamB;

  const scoreColor =
    dispScore >= 80 ? "#22c55e" :
    dispScore >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-4 fade-in">
      {/* ── Score header ── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: "hsl(224,22%,11%)", border: `1px solid ${isEditing ? "rgba(200,149,42,0.35)" : "hsl(224,16%,18%)"}` }}
      >
        {isEditing && (
          <div className="flex items-center gap-2 mb-3 pb-2.5" style={{ borderBottom: "1px solid hsl(224,16%,16%)" }}>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(200,149,42,0.15)", color: "#c8952a" }}
            >
              수정 모드
            </span>
            <span className="text-[11px] text-muted-foreground">
              {selected
                ? "같은 팀 → 포지션 교체 · 다른 팀 → 팀 이동"
                : "교체할 플레이어를 선택하세요"}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span
              className="text-3xl font-bold tabular-nums transition-all duration-300"
              style={{ color: scoreColor }}
            >
              {dispScore}
            </span>
            <div>
              <p className="text-sm font-semibold">{tResult("balanceScore")}</p>
              <p className="text-xs text-muted-foreground">
                {tResult("strengthGapPt", { gap: dispGap })}
                {dispOff > 0 && " " + tResult("offRoleSuffix", { n: dispOff })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={resetEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "hsl(224,18%,16%)", border: "1px solid hsl(224,16%,22%)" }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  초기화
                </button>
                <button
                  onClick={confirmEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  style={{ background: "rgba(200,149,42,0.15)", border: "1px solid rgba(200,149,42,0.35)", color: "#c8952a" }}
                >
                  <Check className="h-3.5 w-3.5" />
                  완료
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  style={{ background: "hsl(224,18%,16%)", border: "1px solid hsl(224,16%,22%)" }}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
                  {tGenerate("regenerate")}
                </button>
                <button
                  onClick={onShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "hsl(224,18%,16%)", border: "1px solid hsl(224,16%,22%)" }}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                  {copied ? tCommon("copied") : tGenerate("share")}
                </button>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "hsl(224,18%,16%)", border: "1px solid hsl(224,16%,22%)" }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  수정
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{tResult("teamA")} · {Math.round(dispA.totalStrength)}</span>
            <span>{tResult("teamB")} · {Math.round(dispB.totalStrength)}</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(224,18%,16%)" }}>
            {(() => {
              const total = dispA.totalStrength + dispB.totalStrength || 1;
              const aW = (dispA.totalStrength / total) * 100;
              return (
                <>
                  <div className="transition-all duration-500" style={{ width: `${aW}%`, background: "#3b82f6" }} />
                  <div className="flex-1" style={{ background: "#ef4444" }} />
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Team cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {isEditing ? (
          <>
            <EditableTeamCard
              composition={editTeamA}
              side="A"
              selected={selected}
              onPlayerClick={(puuid) => handlePlayerClick(puuid, "A")}
            />
            <EditableTeamCard
              composition={editTeamB}
              side="B"
              selected={selected}
              onPlayerClick={(puuid) => handlePlayerClick(puuid, "B")}
            />
          </>
        ) : (
          <>
            <TeamCard composition={dispA} side="A" />
            <TeamCard composition={dispB} side="B" />
          </>
        )}
      </div>

      {/* ── Analysis ── */}
      {!isEditing && (
        <div
          className="rounded-xl px-5 py-4 space-y-2"
          style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tResult("analysis")}</p>
          {explanation.map((line, i) => (
            <p key={i} className="text-[12px] text-muted-foreground leading-relaxed">
              · {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editable Team Card (edit mode) ───────────────────────────────────────────

function EditableTeamCard({ composition, side, selected, onPlayerClick }: {
  composition: TeamGenerationResult["teamA"];
  side: "A" | "B";
  selected: { puuid: string; team: "A" | "B" } | null;
  onPlayerClick: (puuid: string) => void;
}) {
  const tResult = useTranslations("result");
  const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  const sorted = [...composition.roleAssignments].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );
  const isMyTeam = (puuid: string) => composition.players.some((p) => p.puuid === puuid);
  const hasSelectionFromOtherTeam = selected && !isMyTeam(selected.puuid);
  const hasSelectionFromMyTeam = selected && isMyTeam(selected.puuid);

  return (
    <div
      className={cn("rounded-xl overflow-hidden transition-all", side === "A" ? "team-a-top" : "team-b-top")}
      style={{ background: "hsl(224,22%,11%)", border: "1px solid hsl(224,16%,18%)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid hsl(224,16%,16%)" }}
      >
        <span className={cn("font-bold text-sm", side === "A" ? "text-blue-400" : "text-red-400")}>
          {tResult(side === "A" ? "teamA" : "teamB")}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {Math.round(composition.totalStrength)}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "hsl(224,16%,15%)" }}>
        {sorted.map((asgn) => {
          const player = composition.players.find((p) => p.puuid === asgn.puuid);
          if (!player) return null;
          const bestRanked = player.soloRanked ?? player.flexRanked;
          const tier = bestRanked?.tier;
          const isSelected = selected?.puuid === asgn.puuid;
          const isCrossSwappable = !isSelected && hasSelectionFromOtherTeam;
          const isSameSwappable = !isSelected && hasSelectionFromMyTeam && isMyTeam(asgn.puuid);

          return (
            <button
              key={asgn.puuid}
              onClick={() => onPlayerClick(asgn.puuid)}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all cursor-pointer",
                isSelected
                  ? "bg-amber-500/10"
                  : isSameSwappable
                  ? "hover:bg-emerald-500/8"
                  : isCrossSwappable
                  ? "hover:bg-blue-500/5"
                  : "hover:bg-white/3"
              )}
              style={isSelected ? { boxShadow: "inset 0 0 0 1px rgba(200,149,42,0.4)" } : undefined}
            >
              <span className={cn("text-[11px] font-bold w-7 shrink-0", ROLE_COLOR[asgn.role])}>
                {tResult(`roleShort.${asgn.role}` as `roleShort.${Role}`)}
              </span>
              <span className={cn(
                "flex-1 min-w-0 text-[13px] font-medium truncate transition-colors",
                isSelected ? "text-amber-300" : "text-foreground"
              )}>
                {player.gameName}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {tier && (
                  <span className={cn("text-[10px] font-bold", TIER_COLOR[tier])}>
                    {TIER_ABBR[tier]}{bestRanked?.rank}
                  </span>
                )}
                {isSelected && (
                  <span className="text-[9px] font-bold" style={{ color: "#c8952a" }}>선택됨</span>
                )}
                {isSameSwappable && (
                  <span className="text-[9px] text-emerald-400/70">↕</span>
                )}
                {isCrossSwappable && (
                  <span className="text-[9px] text-muted-foreground/50">↔</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({ composition, side }: {
  composition: TeamGenerationResult["teamA"];
  side: "A" | "B";
}) {
  const tResult = useTranslations("result");
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
          {tResult(side === "A" ? "teamA" : "teamB")}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {Math.round(composition.totalStrength)}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "hsl(224,16%,15%)" }}>
        {sorted.map((asgn) => {
          const player = composition.players.find((p) => p.puuid === asgn.puuid);
          if (!player) return null;
          // Show best available rank (solo preferred, flex as fallback)
          const bestRanked = player.soloRanked ?? player.flexRanked;
          const tier = bestRanked?.tier;

          return (
            <div key={asgn.puuid} className="flex items-center gap-2.5 px-4 py-2.5">
              <span className={cn("text-[11px] font-bold w-7 shrink-0", ROLE_COLOR[asgn.role])}>
                {tResult(`roleShort.${asgn.role}` as `roleShort.${Role}`)}
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                {player.gameName}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {tier && (
                  <span className={cn("text-[10px] font-bold", TIER_COLOR[tier])}>
                    {TIER_ABBR[tier]}{bestRanked?.rank}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
                  {Math.round(asgn.roleScore)}
                </span>
                {asgn.isOffRole && (
                  <span
                    className="text-[9px] font-bold px-1 py-0.5 rounded"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                  >
                    {tResult("offRoleBadge")}
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
