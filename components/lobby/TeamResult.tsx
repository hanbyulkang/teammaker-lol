"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CheckCircle2,
  Info,
  RefreshCw,
  Share2,
  Shield,
  Sword,
  Trophy,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RoleIcon } from "@/components/common/RoleIcon";
import { TierBadge } from "@/components/common/TierBadge";
import { cn, balanceLabel, lobbyUrl } from "@/lib/utils";
import type { TeamGenerationResult, RoleAssignment, PlayerProfile } from "@/types";

interface TeamResultProps {
  result: TeamGenerationResult;
  lobbyId?: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function TeamResult({
  result,
  lobbyId,
  onRegenerate,
  isRegenerating,
}: TeamResultProps) {
  const t = useTranslations("result");
  const [copied, setCopied] = useState(false);

  const { teamA, teamB, balanceScore, strengthGap, offRoleCount, explanation } =
    result;

  const balanceKey = balanceLabel(balanceScore);
  const balanceText = t(balanceKey);

  const handleShare = async () => {
    const url = lobbyId ? lobbyUrl(lobbyId) : window.location.href;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Balance summary bar */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold",
                  balanceScore >= 90
                    ? "bg-green-500/15 border-green-500/30 text-green-400"
                    : balanceScore >= 75
                      ? "bg-green-500/10 border-green-500/20 text-green-400"
                      : balanceScore >= 55
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                        : "bg-red-500/15 border-red-500/30 text-red-400"
                )}
              >
                {balanceScore}
              </div>
              <div>
                <p className="text-sm font-semibold">{t("balanceScore")}</p>
                <p className="text-xs text-muted-foreground">
                  {balanceText} · {t("strengthGap")}: {Math.round(strengthGap)} pts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {offRoleCount === 0 ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("noOffRole")}
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t("offRoleCount", { count: offRoleCount })}
                </Badge>
              )}

              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Info className="h-3 w-3" />
                {t("candidatesEvaluated", {
                  count: result.candidatesEvaluated,
                })}
              </Badge>
            </div>
          </div>

          {/* Balance bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>Team A · {Math.round(teamA.totalStrength)} pts</span>
              <span>Team B · {Math.round(teamB.totalStrength)} pts</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden">
              {(() => {
                const total = teamA.totalStrength + teamB.totalStrength;
                const aFrac = total > 0 ? (teamA.totalStrength / total) * 100 : 50;
                return (
                  <>
                    <div
                      className="bg-blue-500/70 transition-all duration-500"
                      style={{ width: `${aFrac}%` }}
                    />
                    <div className="flex-1 bg-red-500/60" />
                  </>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamPanel
          title={t("teamA")}
          composition={teamA}
          side="A"
          t={t}
        />
        <TeamPanel
          title={t("teamB")}
          composition={teamB}
          side="B"
          t={t}
        />
      </div>

      {/* Explanation */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            {t("explanation")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-2">
            {explanation.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500/70" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {result.satisfiedConstraints.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-green-400">
                  {t("constraintsSatisfied")} (
                  {result.satisfiedConstraints.length})
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onRegenerate && (
          <Button
            onClick={onRegenerate}
            disabled={isRegenerating}
            variant="outline"
            size="default"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRegenerating && "animate-spin")}
            />
            {t("regenerate")}
          </Button>
        )}
        <Button onClick={handleShare} variant="secondary" size="default">
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-400" />
              {t("shareCopied")}
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              {t("share")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Team Panel ───────────────────────────────────────────────────────────────

interface TeamPanelProps {
  title: string;
  composition: TeamGenerationResult["teamA"];
  side: "A" | "B";
  t: ReturnType<typeof useTranslations<"result">>;
}

function TeamPanel({ title, composition, side, t }: TeamPanelProps) {
  const borderClass =
    side === "A" ? "border-t-blue-500/70" : "border-t-red-500/60";
  const strengthClass =
    side === "A" ? "text-blue-400" : "text-red-400";

  return (
    <Card className={cn("border-t-2", borderClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {side === "A" ? (
              <Shield className="h-4 w-4 text-blue-400" />
            ) : (
              <Sword className="h-4 w-4 text-red-400" />
            )}
            {title}
          </CardTitle>
          <span className={cn("text-xs font-mono font-semibold", strengthClass)}>
            {Math.round(composition.totalStrength)} {t("strengthLabel")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {composition.roleAssignments.map((assignment) => {
          const player = composition.players.find(
            (p) => p.puuid === assignment.puuid
          );
          if (!player) return null;

          return (
            <PlayerRow
              key={assignment.puuid}
              player={player}
              assignment={assignment}
              t={t}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Player Row in team panel ─────────────────────────────────────────────────

interface PlayerRowProps {
  player: PlayerProfile;
  assignment: RoleAssignment;
  t: ReturnType<typeof useTranslations<"result">>;
}

function PlayerRow({ player, assignment, t }: PlayerRowProps) {
  const soloEntry = player.soloRanked;

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 bg-muted/20 hover:bg-muted/30 transition-colors">
      {/* Role */}
      <RoleIcon role={assignment.role} size="md" />

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">
          {player.gameName}
          <span className="text-muted-foreground font-normal text-xs">
            #{player.tagLine}
          </span>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <TierBadge
            tier={soloEntry?.tier ?? null}
            division={soloEntry?.rank}
            size="sm"
          />
          {assignment.isPrimaryRole && (
            <Badge variant="success" className="text-[10px] px-1 py-0">
              {t("comfortBadge")}
            </Badge>
          )}
          {assignment.isOffRole && (
            <Badge variant="warning" className="text-[10px] px-1 py-0">
              {t("offRoleBadge")}
            </Badge>
          )}
        </div>
      </div>

      {/* Role score */}
      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
        {Math.round(assignment.roleScore)}
      </span>
    </div>
  );
}
