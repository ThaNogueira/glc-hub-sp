import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { TYPES } from "@/lib/types";

export const runtime = "nodejs";
export const alt = "Perfil de treinador no GLC Hub SP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await prisma.player.findUnique({
    where: { slug },
    include: { badges: { where: { status: "ACTIVE" }, select: { type: true } } },
  });

  const name = player?.name ?? "Treinador";
  const perType = new Map<string, number>();
  for (const b of player?.badges ?? []) perType.set(b.type, (perType.get(b.type) ?? 0) + 1);
  const wins = player?.badges.length ?? 0;
  const distinct = perType.size;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b0f17 0%, #141c2e 100%)",
          color: "#e8edf7",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "#ff5d4a",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 30, color: "#8b98b0", display: "flex" }}>
            GLC Hub SP · Gym Leader Challenge São Paulo
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 76, fontWeight: 700, display: "flex" }}>{name}</div>
          <div style={{ fontSize: 36, color: "#8b98b0", display: "flex" }}>
            {wins} vitória{wins === 1 ? "" : "s"} · {distinct}/11 insígnias de ginásio
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {TYPES.map((t) => {
            const earned = (perType.get(t.id) ?? 0) > 0;
            return (
              <div
                key={t.id}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: earned ? t.color : "rgba(148,163,199,0.12)",
                  border: earned
                    ? "4px solid rgba(255,255,255,0.55)"
                    : "4px solid rgba(148,163,199,0.2)",
                  fontSize: 30,
                  fontWeight: 700,
                  color: earned ? t.textOn : "#3a4358",
                }}
              >
                {t.pt.charAt(0)}
              </div>
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
