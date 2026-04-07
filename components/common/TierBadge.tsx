import { cn } from "@/lib/utils";
import type { Tier, Division } from "@/types";

interface TierBadgeProps {
  tier: Tier | null;
  division?: Division | null;
  lp?: number;
  size?: "sm" | "md" | "lg";
  showLP?: boolean;
  className?: string;
}

const TIER_CONFIG: Record<
  Tier,
  { label: string; color: string; bg: string; border: string }
> = {
  IRON: {
    label: "Iron",
    color: "text-[#a09890]",
    bg: "bg-[#736a64]/15",
    border: "border-[#736a64]/30",
  },
  BRONZE: {
    label: "Bronze",
    color: "text-[#d4956a]",
    bg: "bg-[#cd7f32]/15",
    border: "border-[#cd7f32]/30",
  },
  SILVER: {
    label: "Silver",
    color: "text-[#c0c2c8]",
    bg: "bg-[#a8a9ad]/15",
    border: "border-[#a8a9ad]/30",
  },
  GOLD: {
    label: "Gold",
    color: "text-[#f0d060]",
    bg: "bg-[#ffd700]/15",
    border: "border-[#ffd700]/30",
  },
  PLATINUM: {
    label: "Plat",
    color: "text-[#7dd4e8]",
    bg: "bg-[#4fc3f7]/15",
    border: "border-[#4fc3f7]/30",
  },
  EMERALD: {
    label: "Emerald",
    color: "text-[#6ddb8c]",
    bg: "bg-[#50c878]/15",
    border: "border-[#50c878]/30",
  },
  DIAMOND: {
    label: "Diamond",
    color: "text-[#a8e8f8]",
    bg: "bg-[#b9f2ff]/15",
    border: "border-[#b9f2ff]/30",
  },
  MASTER: {
    label: "Master",
    color: "text-[#c084fc]",
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
  },
  GRANDMASTER: {
    label: "GM",
    color: "text-[#f87171]",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
  },
  CHALLENGER: {
    label: "Chall",
    color: "text-[#fbbf24]",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
  },
};

const SIZE_CLASSES = {
  sm: "px-1.5 py-0.5 text-[10px] rounded",
  md: "px-2 py-0.5 text-xs rounded-md",
  lg: "px-2.5 py-1 text-sm rounded-md",
};

export function TierBadge({
  tier,
  division,
  lp,
  size = "md",
  showLP = false,
  className,
}: TierBadgeProps) {
  if (!tier) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-semibold border border-border bg-muted/50 text-muted-foreground",
          SIZE_CLASSES[size],
          className
        )}
      >
        Unranked
      </span>
    );
  }

  const config = TIER_CONFIG[tier];
  const isApex =
    tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";
  const divLabel = !isApex && division ? ` ${division}` : "";
  const lpLabel = showLP && lp !== undefined ? ` ${lp} LP` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center font-bold border",
        SIZE_CLASSES[size],
        config.color,
        config.bg,
        config.border,
        className
      )}
    >
      {config.label}
      {divLabel}
      {lpLabel}
    </span>
  );
}

/** Full rank display with tier + division + LP */
export function RankDisplay({
  tier,
  division,
  lp,
  className,
}: {
  tier: Tier | null;
  division?: Division | null;
  lp?: number;
  className?: string;
}) {
  if (!tier) {
    return (
      <span className={cn("text-muted-foreground text-sm", className)}>
        Unranked
      </span>
    );
  }

  const config = TIER_CONFIG[tier];
  const isApex =
    tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";

  return (
    <span className={cn("font-semibold text-sm", config.color, className)}>
      {config.label}
      {!isApex && division ? ` ${division}` : ""}
      {lp !== undefined ? ` · ${lp} LP` : ""}
    </span>
  );
}
