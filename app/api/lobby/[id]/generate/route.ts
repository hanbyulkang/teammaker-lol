import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateTeams, isOptimizerError } from "@/lib/optimizer/teamOptimizer";
import type { TeamConstraint, PlayerProfile } from "@/types";

const constraintSchema = z.object({
  id: z.string(),
  type: z.enum(["TOGETHER", "OPPOSITE"]),
  puuidA: z.string(),
  puuidB: z.string(),
});

const schema = z.object({
  constraints: z.array(constraintSchema).default([]),
  // Accept profiles directly from client — avoids cache miss issues
  profiles: z.array(z.any()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const constraints: TeamConstraint[] = parsed.data.constraints;
    let profiles: PlayerProfile[];

    if (parsed.data.profiles && parsed.data.profiles.length === 10) {
      // Use profiles sent directly from client (preferred path)
      profiles = parsed.data.profiles as PlayerProfile[];
    } else {
      // Fall back to loading from DB cache
      const lobby = await prisma.lobby.findUnique({
        where: { id },
        include: { players: true },
      });

      if (!lobby) {
        return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
      }

      profiles = await Promise.all(
        lobby.players.map(async (lp) => {
          const cached = await prisma.cachedPlayer.findUnique({
            where: { puuid: lp.puuid },
          });
          if (!cached) {
            throw new Error(`Profile not found for ${lp.gameName}#${lp.tagLine}. Please re-validate players.`);
          }
          return cached.profileData as unknown as PlayerProfile;
        })
      );
    }

    if (profiles.length !== 10) {
      return NextResponse.json(
        { error: `Need exactly 10 players, got ${profiles.length}` },
        { status: 422 }
      );
    }

    // Run optimizer
    const output = generateTeams(profiles, constraints);

    if (isOptimizerError(output)) {
      return NextResponse.json(
        { error: output.error, details: output.details },
        { status: 422 }
      );
    }

    // Persist result (best effort — don't fail if DB write fails)
    try {
      await prisma.$transaction([
        prisma.lobbyConstraint.deleteMany({ where: { lobbyId: id } }),
        ...(constraints.length > 0
          ? [prisma.lobbyConstraint.createMany({
              data: constraints.map((c) => ({
                lobbyId: id,
                type: c.type,
                puuidA: c.puuidA,
                puuidB: c.puuidB,
              })),
            })]
          : []),
        prisma.generatedResult.upsert({
          where: { lobbyId: id },
          create: {
            lobbyId: id,
            result: output.result as unknown as import("@prisma/client").Prisma.InputJsonValue,
          },
          update: {
            result: output.result as unknown as import("@prisma/client").Prisma.InputJsonValue,
            createdAt: new Date(),
          },
        }),
      ]);
    } catch (dbErr) {
      console.warn("DB persist failed (non-fatal):", dbErr);
    }

    return NextResponse.json({ result: output.result });
  } catch (err) {
    console.error("generate error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
