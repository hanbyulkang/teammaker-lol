"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, parseRiotIdList } from "@/lib/utils";
import { PLATFORMS } from "@/lib/riot/constants";
import type { Platform, PlayerProfile } from "@/types";

interface PlayerInputFormProps {
  onPlayersValidated: (
    players: PlayerProfile[],
    errors: { riotId: string; message: string }[]
  ) => void;
  isLoading?: boolean;
}

const REGION_GROUPS = [
  { label: "Asia", platforms: ["kr", "jp1"] },
  { label: "Americas", platforms: ["na1", "br1", "la1", "la2"] },
  { label: "Europe", platforms: ["euw1", "eune1", "tr1", "ru"] },
  { label: "Southeast Asia", platforms: ["oc1", "sg2", "tw2", "vn2", "ph2"] },
] as const;

export function PlayerInputForm({
  onPlayersValidated,
  isLoading = false,
}: PlayerInputFormProps) {
  const t = useTranslations("input");
  const tErrors = useTranslations("errors");

  const [platform, setPlatform] = useState<Platform>("kr");
  const [rawInput, setRawInput] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async () => {
    setParseErrors([]);
    setFetchError(null);

    const { valid, errors } = parseRiotIdList(rawInput);
    const localErrors: string[] = [];

    for (const e of errors) {
      if (e.reason === "format") {
        localErrors.push(t("parseError", { id: e.raw }));
      } else if (e.reason === "duplicate") {
        localErrors.push(t("duplicateError", { id: e.raw }));
      }
    }

    if (valid.length !== 10) {
      localErrors.push(t("countError", { count: valid.length }));
    }

    if (localErrors.length > 0) {
      setParseErrors(localErrors);
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch("/api/riot/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, players: valid }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFetchError(data.error ?? tErrors("serverError"));
        return;
      }

      const data = await res.json();
      onPlayersValidated(data.players, data.errors ?? []);
    } catch {
      setFetchError(tErrors("networkError"));
    } finally {
      setIsValidating(false);
    }
  };

  const lineCount = rawInput
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  const busy = isLoading || isValidating;

  return (
    <div className="space-y-5">
      {/* Platform selector */}
      <div className="space-y-2">
        <Label htmlFor="platform">{t("platform")}</Label>
        <Select
          value={platform}
          onValueChange={(v) => setPlatform(v as Platform)}
        >
          <SelectTrigger id="platform" className="w-full sm:w-64">
            <SelectValue placeholder={t("platformPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {REGION_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.platforms.map((p) => {
                  const info = PLATFORMS.find((pl) => pl.value === p)!;
                  return (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span>{info.flag}</span>
                        <span>{info.label}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Player list input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="players">{t("players")}</Label>
          <span
            className={cn(
              "text-xs font-mono",
              lineCount === 10
                ? "text-green-400"
                : lineCount > 0
                  ? "text-amber-400"
                  : "text-muted-foreground"
            )}
          >
            {t("playerCount", { count: lineCount })}
          </span>
        </div>
        <Textarea
          id="players"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={t("playersPlaceholder")}
          className="h-52 text-sm leading-6"
          disabled={busy}
        />
        <p className="text-[11px] text-muted-foreground">{t("formatHint")}</p>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/8 p-3 space-y-1">
          {parseErrors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/8 p-3 flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleValidate}
        disabled={busy || lineCount === 0}
        variant="gold"
        size="lg"
        className="w-full"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("validating")}
          </>
        ) : (
          <>
            <Users className="h-4 w-4" />
            {t("validateButton")}
          </>
        )}
      </Button>
    </div>
  );
}
