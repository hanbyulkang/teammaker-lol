import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface RoleIconProps {
  role: Role;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  labelOverride?: string;
  className?: string;
}

const ROLE_CONFIG: Record<
  Role,
  { short: string; label: string; bg: string; text: string; border: string }
> = {
  TOP: {
    short: "T",
    label: "Top",
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
  },
  JUNGLE: {
    short: "J",
    label: "Jgl",
    bg: "bg-green-500/15",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  MID: {
    short: "M",
    label: "Mid",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  ADC: {
    short: "A",
    label: "ADC",
    bg: "bg-pink-500/15",
    text: "text-pink-400",
    border: "border-pink-500/30",
  },
  SUPPORT: {
    short: "S",
    label: "Sup",
    bg: "bg-yellow-500/15",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
};

const SIZE_CLASSES = {
  xs: "h-5 w-5 text-[10px] rounded",
  sm: "h-6 w-6 text-xs rounded",
  md: "h-8 w-8 text-sm rounded-md",
  lg: "h-10 w-10 text-base rounded-md",
};

const LABEL_SIZE_CLASSES = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function RoleIcon({
  role,
  size = "sm",
  showLabel = false,
  labelOverride,
  className,
}: RoleIconProps) {
  const config = ROLE_CONFIG[role];

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className={cn(
          "inline-flex items-center justify-center font-bold border",
          SIZE_CLASSES[size],
          config.bg,
          config.text,
          config.border
        )}
        title={config.label}
      >
        {config.short}
      </div>
      {showLabel && (
        <span
          className={cn("font-medium", config.text, LABEL_SIZE_CLASSES[size])}
        >
          {labelOverride ?? config.label}
        </span>
      )}
    </div>
  );
}

/** Inline row of all 5 roles, compact */
export function RoleRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as Role[]).map((r) => (
        <RoleIcon key={r} role={r} size="xs" />
      ))}
    </div>
  );
}
