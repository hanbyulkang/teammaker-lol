import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildPlayerProfiles } from "@/lib/analysis/playerProfile";
import type { ResolvePlayersResponse } from "@/types";

const schema = z.object({
  platform: z.string().min(1),
  players: z
    .array(
      z.object({
        gameName: z.string().min(1),
        tagLine: z.string().min(1),
      })
    )
    .min(1)
    .max(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { platform, players } = parsed.data;

    const { profiles, errors } = await buildPlayerProfiles(
      players,
      platform as import("@/types").Platform
    );

    const response: ResolvePlayersResponse = { players: profiles, errors };
    return NextResponse.json(response);
  } catch (err) {
    console.error("resolve/route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
