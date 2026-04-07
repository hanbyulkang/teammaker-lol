import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  platform: z.string().min(1),
  players: z
    .array(
      z.object({
        puuid: z.string(),
        gameName: z.string(),
        tagLine: z.string(),
      })
    )
    .length(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const { platform, players } = parsed.data;

    const lobby = await prisma.lobby.create({
      data: {
        platform,
        players: {
          create: players.map((p) => ({
            puuid: p.puuid,
            gameName: p.gameName,
            tagLine: p.tagLine,
          })),
        },
      },
    });

    return NextResponse.json({ lobbyId: lobby.id });
  } catch (err) {
    console.error("lobby/route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
