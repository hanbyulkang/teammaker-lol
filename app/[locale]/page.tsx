"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Swords, ChevronRight, Users, Settings2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PlayerInputForm } from "@/components/lobby/PlayerInputForm";
import { PlayerCard, PlayerCardSkeleton } from "@/components/lobby/PlayerCard";
import { ConstraintBuilder } from "@/components/lobby/ConstraintBuilder";
import { TeamResult } from "@/components/lobby/TeamResult";
import { cn } from "@/lib/utils";
import type { PlayerProfile, TeamConstraint, TeamGenerationResult } from "@/types";

type Step = "input" | "review" | "result";

export default function HomePage() {
  const t = useTranslations();

  const [step, setStep] = useState<Step>("input");
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [fetchErrors, setFetchErrors] = useState<
    { riotId: string; message: string }[]
  >([]);
  const [constraints, setConstraints] = useState<TeamConstraint[]>([]);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [result, setResult] = useState<TeamGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ── Step 1 complete: players validated ───────────────────────────────────

  const handlePlayersValidated = async (
    validatedPlayers: PlayerProfile[],
    errors: { riotId: string; message: string }[]
  ) => {
    setPlayers(validatedPlayers);
    setFetchErrors(errors);

    if (validatedPlayers.length === 10 && errors.length === 0) {
      // Create lobby in DB
      try {
        const res = await fetch("/api/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: validatedPlayers[0].platform,
            players: validatedPlayers.map((p) => ({
              puuid: p.puuid,
              gameName: p.gameName,
              tagLine: p.tagLine,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setLobbyId(data.lobbyId);
        }
      } catch {
        // Non-fatal: lobby creation failure doesn't block the UX
      }

      setStep("review");
    } else if (validatedPlayers.length > 0) {
      setStep("review"); // show partial results with errors
    }
  };

  // ── Step 2 complete: generate teams ──────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const endpoint = lobbyId
        ? `/api/lobby/${lobbyId}/generate`
        : "/api/lobby/temp/generate";

      // If no lobbyId, we need to create one first
      let finalLobbyId = lobbyId;
      if (!finalLobbyId) {
        const createRes = await fetch("/api/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: players[0].platform,
            players: players.map((p) => ({
              puuid: p.puuid,
              gameName: p.gameName,
              tagLine: p.tagLine,
            })),
          }),
        });
        if (createRes.ok) {
          const data = await createRes.json();
          finalLobbyId = data.lobbyId;
          setLobbyId(finalLobbyId);
        }
      }

      if (!finalLobbyId) {
        setGenerateError(t("errors.serverError"));
        return;
      }

      const res = await fetch(`/api/lobby/${finalLobbyId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constraints }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenerateError(data.error ?? t("errors.serverError"));
        if (data.details) console.error("Optimizer errors:", data.details);
        return;
      }

      setResult(data.result);
      setStep("result");
    } catch {
      setGenerateError(t("errors.networkError"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setResult(null);
    setStep("review");
  };

  const handleReset = () => {
    setStep("input");
    setPlayers([]);
    setFetchErrors([]);
    setConstraints([]);
    setLobbyId(null);
    setResult(null);
    setGenerateError(null);
  };

  return (
    <div className="grid-bg min-h-[calc(100vh-57px)]">
      {/* Hero */}
      <section className="relative py-16 md:py-24">
        <div className="container max-w-3xl text-center">
          <Badge variant="gold" className="mb-4 inline-flex">
            <Swords className="h-3 w-3 mr-1" />
            {t("hero.badge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-4">
            {t("hero.title")}{" "}
            <span className="text-primary">{t("hero.titleAccent")}</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            {t("hero.subtitle")}
          </p>
        </div>
      </section>

      {/* How it works — shown only on input step */}
      {step === "input" && (
        <section className="pb-12">
          <div className="container max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
              {[
                {
                  icon: Users,
                  title: t("howItWorks.step1Title"),
                  desc: t("howItWorks.step1Desc"),
                },
                {
                  icon: Settings2,
                  title: t("howItWorks.step2Title"),
                  desc: t("howItWorks.step2Desc"),
                },
                {
                  icon: Zap,
                  title: t("howItWorks.step3Title"),
                  desc: t("howItWorks.step3Desc"),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center gap-2 p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main content area */}
      <section className="pb-20">
        <div className="container max-w-4xl">
          {/* Step indicator */}
          {step !== "input" && (
            <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
              <button
                onClick={handleReset}
                className="hover:text-foreground transition-colors"
              >
                ← {t("common.back")}
              </button>
              <ChevronRight className="h-3 w-3" />
              <span
                className={
                  step === "review" ? "text-foreground font-medium" : ""
                }
              >
                Review Players
              </span>
              {step === "result" && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">Results</span>
                </>
              )}
            </div>
          )}

          {/* ── STEP 1: Input ── */}
          {step === "input" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {t("input.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerInputForm
                  onPlayersValidated={handlePlayersValidated}
                />
              </CardContent>
            </Card>
          )}

          {/* ── STEP 2: Review + Constraints ── */}
          {step === "review" && (
            <div className="space-y-6">
              {/* Fetch errors */}
              {fetchErrors.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/8 p-4 space-y-1.5">
                  <p className="text-sm font-medium text-destructive">
                    {fetchErrors.length} player(s) could not be loaded:
                  </p>
                  {fetchErrors.map((e) => (
                    <p key={e.riotId} className="text-xs text-destructive/80">
                      · {e.riotId}: {e.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Player grid */}
              <div>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {t("input.title")} ({players.length}/10)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {players.map((p) => (
                    <PlayerCard key={p.puuid} player={p} />
                  ))}
                </div>
              </div>

              {players.length === 10 && (
                <>
                  <Separator />

                  {/* Constraints */}
                  <ConstraintBuilder
                    players={players}
                    constraints={constraints}
                    onChange={setConstraints}
                  />

                  <Separator />

                  {/* Generate */}
                  {generateError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/8 p-3 text-xs text-destructive">
                      {generateError}
                    </div>
                  )}

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    variant="gold"
                    size="lg"
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        {t("generate.generating")}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        {t("generate.button")}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Result ── */}
          {step === "result" && result && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{t("result.title")}</h2>
              <TeamResult
                result={result}
                lobbyId={lobbyId ?? undefined}
                onRegenerate={handleRegenerate}
                isRegenerating={isGenerating}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
