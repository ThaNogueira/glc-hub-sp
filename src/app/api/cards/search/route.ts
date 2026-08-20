import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/cards/search";

export const dynamic = "force-dynamic";

/** Autocomplete do deck builder — busca local (<100ms) na base importada. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const cards = await searchCards({
      q: sp.get("q") ?? undefined,
      type: sp.get("type") ?? undefined,
      supertype: sp.get("supertype") ?? undefined,
      subtype: sp.get("subtype") ?? undefined,
      setId: sp.get("set") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return NextResponse.json(
      { cards },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (e) {
    console.error("[cards/search]", e);
    return NextResponse.json({ cards: [], error: "search_failed" }, { status: 500 });
  }
}
