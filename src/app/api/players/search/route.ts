import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fold } from "@/lib/normalize";

export const dynamic = "force-dynamic";

/** Autocomplete de jogadores (painel de loja e vínculos). Requer sessão. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ players: [] }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ players: [] });

  const players = await prisma.player.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { aliases: { some: { normalized: { contains: fold(q) } } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 12,
  });
  return NextResponse.json({ players });
}
