"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleIcon } from "@/components/common/RoleIcon";
import { TierBadge } from "@/components/common/TierBadge";
import { cn, formatWinRate } from "@/lib/utils";
import type { PlayerProfile } from "@/types";

interface PlayerCardProps {
  player: PlayerProfile;
  isLoading?: boolean;
  error?: string;
  compact?: boolean;
  className?: string;
}

export function PlayerCard({
  player,
  isLoading,
  error,
  compact = false,
  className,
}: PlayerCardProps) {
  const t = useTranslations("playerCard");

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-2 w-20 rounded bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/40 bg-destructive/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive truncate">
                {player.gameName}#{player.tagLine}
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const soloEntry = player.soloRanked;
  const soloWinRate = soloEntry
    ? formatWinRate(soloEntry.wins, soloEntry.losses)
    : null;
  const soloGames = soloEntry ? soloEntry.wins + soloEntry.losses : 0;
  const isOtp = player.championConcentration >= 0.6;

  if (compact) {
    return (
      <Card className={cn("bg-card/60", className)}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {player.gameName}
                <span className="text-muted-foreground font-normal text-xs">
                  #{player.tagLine}
                </span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <TierBadge
                  tier={soloEntry?.tier ?? null}
                  division={soloEntry?.rank}
                  lp={soloEntry?.leaguePoints}
                  size="sm"
                />
                <div className="flex items-center gap-1">
                  <RoleIcon role={player.primaryRole} size="xs" />
                  <RoleIcon role={player.secondaryRole} size="xs" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "bg-card/70 hover:bg-card transition-colors duration-150",
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header: name + rank */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">
              {player.gameName}
              <span className="text-muted-foreground font-normal text-xs ml-0.5">
                #{player.tagLine}
              </span>
            </h3>
            {soloEntry && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <TierBadge
                  tier={soloEntry.tier}
                  division={soloEntry.rank}
                  lp={soloEntry.leaguePoints}
                  size="sm"
                  showLP
                />
                {soloGames > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {soloWinRate} WR · {soloGames}G
                  </span>
                )}
              </div>
            )}
            {!soloEntry && (
              <span className="text-xs text-muted-foreground">
                {t("unranked")}
              </span>
            )}
          </div>

          {/* OTP warning */}
          {isOtp && (
            <Badge variant="warning" className="shrink-0 text-[10px]">
              OTP
            </Badge>
          )}
        </div>

        {/* Role profile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {t("primaryRole")}
              </span>
              <RoleIcon role={player.primaryRole} size="sm" showLabel />
            </div>
            {player.secondaryRole !== player.primaryRole && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t("secondaryRole")}
                </span>
                <RoleIcon role={player.secondaryRole} size="sm" showLabel />
              </div>
            )}
          </div>
        </div>

        {/* Top champions */}
        {player.topChampions.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {t("topChampions")}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {player.topChampions.map((champ) => (
                <span
                  key={champ}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium"
                >
                  {champ}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent match indicator */}
        {player.recentMatches.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {player.recentMatches.length} recent match
              {player.recentMatches.length !== 1 ? "es" : ""}
            </span>
            <div className="flex items-center gap-0.5 ml-1">
              {player.recentMatches.slice(0, 8).map((m) => (
                <div
                  key={m.matchId}
                  className={cn(
                    "h-2 w-1.5 rounded-sm",
                    m.win ? "bg-green-500/70" : "bg-red-500/50"
                  )}
                  title={m.win ? "Win" : "Loss"}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Loading skeleton for player card */
export function PlayerCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-14 rounded bg-muted animate-pulse" />
          <div className="h-6 w-14 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}
