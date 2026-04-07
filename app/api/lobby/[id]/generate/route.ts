import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateTeams, isOptimizerError } from "@/lib/optimizer/teamOptimizer";
import type { TeamConstraint, PlayerProfile, Platform } from "@/types";

const constraintSchema = z.object({
  id: z.string(),
  type: z.enum(["TOGETHER", "OPPOSITE"]),
  puuidA: z.string(),
  puuidB: z.string(),
});

const schema = z.object({
  constraints: z.array(constraintSchema).default([]),
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
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Load lobby
    const lobby = await prisma.lobby.findUnique({
      where: { id },
      include: { players: true },
    });

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    }

    // Load cached player profiles
    const profiles = await Promise.all(
      lobby.players.map(async (lp) => {
        const cached = await prisma.cachedPlayer.findUnique({
          where: { puuid: lp.puuid },
        });
        if (!cached) {
          throw new Error(`No cached profile for player ${lp.gameName}#${lp.tagLine}`);
        }
        return cached.profileData as unknown as PlayerProfile;
      })
    );

    const constraints: TeamConstraint[] = parsed.data.constraints;

    // Run optimizer (synchronous — fast enough for serverless)
    const output = generateTeams(profiles, constraints);

    if (isOptimizerError(output)) {
      return NextResponse.json(
        { error: output.error, details: output.details },
        { status: 422 }
      );
    }

    // Persist constraints and result
    await prisma.$transaction([
      // Clear old constraints
      prisma.lobbyConstraint.deleteMany({ where: { lobbyId: id } }),
      // Insert new constraints
      ...(constraints.length > 0
        ? [
            prisma.lobbyConstraint.createMany({
              data: constraints.map((c) => ({
                lobbyId: id,
                type: c.type,
                puuidA: c.puuidA,
                puuidB: c.puuidB,
              })),
            }),
          ]
        : []),
      // Upsert result
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

    return NextResponse.json({ result: output.result });
  } catch (err) {
    console.error("lobby/[id]/generate error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
