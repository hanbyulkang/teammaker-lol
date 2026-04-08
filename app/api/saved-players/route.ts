import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// GET — fetch the current user's saved players
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const saved = await prisma.savedPlayer.findMany({
    where: { userId: session.user.id },
    orderBy: { savedAt: "desc" },
  });

  return NextResponse.json({ players: saved });
}

const saveSchema = z.object({
  players: z.array(
    z.object({
      puuid: z.string(),
      gameName: z.string(),
      tagLine: z.string(),
      platform: z.string(),
      profileData: z.unknown(),
    })
  ),
});

// POST — batch upsert saved players for the current user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { players } = parsed.data;
  const userId = session.user.id;

  // Upsert all players — update profileData if already saved
  await Promise.all(
    players.map((p) =>
      prisma.savedPlayer.upsert({
        where: { userId_puuid: { userId, puuid: p.puuid } },
        create: {
          userId,
          puuid: p.puuid,
          gameName: p.gameName,
          tagLine: p.tagLine,
          platform: p.platform,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          profileData: p.profileData as any,
        },
        update: {
          gameName: p.gameName,
          tagLine: p.tagLine,
          platform: p.platform,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          profileData: p.profileData as any,
          updatedAt: new Date(),
        },
      })
    )
  );

  return NextResponse.json({ saved: players.length });
}
