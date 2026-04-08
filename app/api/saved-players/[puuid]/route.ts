import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ puuid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { puuid } = await params;

  await prisma.savedPlayer.deleteMany({
    where: { userId: session.user.id, puuid },
  });

  return NextResponse.json({ ok: true });
}
