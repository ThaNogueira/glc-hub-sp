import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { TYPE_BY_ID } from "@/lib/types";

export const runtime = "nodejs";
export const alt = "Deck GLC no GLC Hub SP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await prisma.deck.findUnique({
    where: { slug },
    include: {
      coverCard: true,
      player: { select: { name: true } },
      author: { select: { displayName: true } },
    },
  });

  const t = deck ? TYPE_BY_ID[deck.type] : TYPE_BY_ID.COLORLESS;
  const author = deck?.player?.name ?? deck?.author?.displayName ?? null;
  const cover = deck?.coverCard?.imageLarge ?? deck?.coverCard?.imageSmall ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(120deg, #0b0f17 45%, ${t.color}55 130%)`,
          color: "#e8edf7",
          padding: 64,
          fontFamily: "sans-serif",
          alignItems: "center",
          gap: 56,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            flex: 1,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "#ff5d4a", display: "flex" }} />
            <div style={{ fontSize: 28, color: "#8b98b0", display: "flex" }}>
              GLC Hub SP · Galeria de decks
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 30,
                fontWeight: 700,
                color: t.textOn,
                background: t.color,
                borderRadius: 999,
                padding: "8px 28px",
                alignSelf: "flex-start",
              }}
            >
              {t.pt}
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, display: "flex", lineHeight: 1.15 }}>
              {deck?.title ?? "Deck GLC"}
            </div>
            {author && (
              <div style={{ fontSize: 32, color: "#8b98b0", display: "flex" }}>por {author}</div>
            )}
          </div>

          <div style={{ fontSize: 26, color: "#8b98b0", display: "flex" }}>
            60 cartas · singleton · mono-tipo — Gym Leader Challenge
          </div>
        </div>

        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            width={340}
            height={475}
            style={{ borderRadius: 18, transform: "rotate(4deg)" }}
            alt=""
          />
        )}
      </div>
    ),
    size,
  );
}
