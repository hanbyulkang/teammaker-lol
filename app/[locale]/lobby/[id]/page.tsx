import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { TeamResult } from "@/components/lobby/TeamResult";
import { PlayerCard } from "@/components/lobby/PlayerCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { PlayerProfile, TeamGenerationResult } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `Lobby ${id.slice(0, 8)} | teammaker.lol`,
  };
}

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("lobby");

  const lobby = await prisma.lobby.findUnique({
    where: { id },
    include: {
      players: true,
      result: true,
    },
  });

  if (!lobby) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">{t("notFound")}</h1>
        <p className="text-muted-foreground mb-6">{t("notFoundDetail")}</p>
        <Button asChild variant="outline">
          <Link href="/">{t("backToHome")}</Link>
        </Button>
      </div>
    );
  }

  // Load cached player profiles
  const profiles: PlayerProfile[] = [];
  for (const lp of lobby.players) {
    const cached = await prisma.cachedPlayer.findUnique({
      where: { puuid: lp.puuid },
    });
    if (cached) {
      profiles.push(cached.profileData as unknown as PlayerProfile);
    }
  }

  const result = lobby.result?.result as TeamGenerationResult | null;

  return (
    <div className="container max-w-4xl py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("results")}</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/">← {t("backToHome")}</Link>
        </Button>
      </div>

      {/* Players */}
      {profiles.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            Players ({profiles.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profiles.map((p) => (
              <PlayerCard key={p.puuid} player={p} compact />
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result ? (
        <TeamResult result={result} lobbyId={id} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>No team result saved for this lobby.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/">Generate Teams</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
