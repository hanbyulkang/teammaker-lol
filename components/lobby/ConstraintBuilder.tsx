"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Users, Swords, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn, formatRiotId } from "@/lib/utils";
import { validateConstraints } from "@/lib/optimizer/constraints";
import type { PlayerProfile, TeamConstraint, ConstraintType } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface ConstraintBuilderProps {
  players: PlayerProfile[];
  constraints: TeamConstraint[];
  onChange: (constraints: TeamConstraint[]) => void;
}

export function ConstraintBuilder({
  players,
  constraints,
  onChange,
}: ConstraintBuilderProps) {
  const t = useTranslations("constraint");

  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [selectedType, setSelectedType] = useState<ConstraintType>("TOGETHER");
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = () => {
    setAddError(null);

    if (!selectedA || !selectedB) return;
    if (selectedA === selectedB) {
      setAddError(t("samePlayerError"));
      return;
    }

    const newConstraint: TeamConstraint = {
      id: uuidv4(),
      type: selectedType,
      puuidA: selectedA,
      puuidB: selectedB,
    };

    const next = [...constraints, newConstraint];

    // Validate immediately
    const validation = validateConstraints(
      players.map((p) => p.puuid),
      next
    );

    if (!validation.valid) {
      setAddError(t("impossible"));
      return;
    }

    onChange(next);
    setSelectedA("");
    setSelectedB("");
  };

  const handleDelete = (id: string) => {
    onChange(constraints.filter((c) => c.id !== id));
  };

  const getPlayer = (puuid: string) =>
    players.find((p) => p.puuid === puuid);

  // Check overall validity of current constraints
  const validation = validateConstraints(
    players.map((p) => p.puuid),
    constraints
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-sm">{t("title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("subtitle")}</p>
      </div>

      {/* Constraint form */}
      <Card className="bg-muted/20">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("addTitle")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Player A */}
            <div className="space-y-1">
              <Label className="text-xs">{t("playerA")}</Label>
              <Select value={selectedA} onValueChange={setSelectedA}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("selectPlayerA")} />
                </SelectTrigger>
                <SelectContent>
                  {players
                    .filter((p) => p.puuid !== selectedB)
                    .map((p) => (
                      <SelectItem key={p.puuid} value={p.puuid}>
                        <span className="text-xs">
                          {p.gameName}#{p.tagLine}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs">{t("type")}</Label>
              <Select
                value={selectedType}
                onValueChange={(v) => setSelectedType(v as ConstraintType)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOGETHER">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Users className="h-3 w-3 text-green-400" />
                      {t("together")}
                    </span>
                  </SelectItem>
                  <SelectItem value="OPPOSITE">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Swords className="h-3 w-3 text-red-400" />
                      {t("opposite")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Player B */}
            <div className="space-y-1">
              <Label className="text-xs">{t("playerB")}</Label>
              <Select value={selectedB} onValueChange={setSelectedB}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("selectPlayerB")} />
                </SelectTrigger>
                <SelectContent>
                  {players
                    .filter((p) => p.puuid !== selectedA)
                    .map((p) => (
                      <SelectItem key={p.puuid} value={p.puuid}>
                        <span className="text-xs">
                          {p.gameName}#{p.tagLine}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {addError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              {addError}
            </p>
          )}

          <Button
            onClick={handleAdd}
            disabled={!selectedA || !selectedB}
            size="sm"
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addButton")}
          </Button>
        </CardContent>
      </Card>

      {/* Constraint list */}
      {constraints.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">{t("noConstraints")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {t("noConstraintsHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {!validation.valid && (
            <div className="rounded-md border border-destructive/40 bg-destructive/8 p-3 flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t("impossible")}</p>
                {validation.errors.map((e, i) => (
                  <p key={i} className="mt-0.5 opacity-80">
                    {e}
                  </p>
                ))}
              </div>
            </div>
          )}

          {constraints.map((c) => {
            const playerA = getPlayer(c.puuidA);
            const playerB = getPlayer(c.puuidB);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-medium truncate">
                    {playerA
                      ? `${playerA.gameName}#${playerA.tagLine}`
                      : c.puuidA.slice(0, 8) + "..."}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0",
                      c.type === "TOGETHER"
                        ? "text-green-400 bg-green-500/10 border-green-500/30"
                        : "text-red-400 bg-red-500/10 border-red-500/30"
                    )}
                  >
                    {c.type === "TOGETHER" ? (
                      <>
                        <Users className="h-2.5 w-2.5" /> with
                      </>
                    ) : (
                      <>
                        <Swords className="h-2.5 w-2.5" /> vs
                      </>
                    )}
                  </span>
                  <span className="text-xs font-medium truncate">
                    {playerB
                      ? `${playerB.gameName}#${playerB.tagLine}`
                      : c.puuidB.slice(0, 8) + "..."}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(c.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
