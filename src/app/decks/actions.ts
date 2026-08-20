"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PokemonType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBanlistNormalized } from "@/lib/cards/search";
import { cardToGlc, parseDeckText, parseDeckUrl, type ParsedDeck } from "@/lib/decks/parse";
import { categoryOf, validateDeck, type DeckEntry } from "@/lib/glc";
import { slugify } from "@/lib/normalize";
import { TYPES } from "@/lib/types";

// ---------------------------------------------------------------------------
// Importação (chamadas do builder — retornam dados, não redirecionam)
// ---------------------------------------------------------------------------

export async function parseDeckTextAction(text: string): Promise<ParsedDeck> {
  await requireUser();
  return parseDeckText(String(text).slice(0, 20_000));
}

export async function parseDeckUrlAction(url: string) {
  await requireUser();
  return parseDeckUrl(String(url).slice(0, 500));
}

// ---------------------------------------------------------------------------
// Salvar / publicar
// ---------------------------------------------------------------------------

export type SaveDeckPayload = {
  deckId?: string;
  title: string;
  type: PokemonType | null; // null = inferir do primeiro Pokémon
  guide: string;
  coverCardId: string | null;
  publish: boolean;
  changelog: string;
  entries: { cardId: string; quantity: number }[];
};

async function uniqueDeckSlug(title: string, deckId?: string): Promise<string> {
  const base = slugify(title) || "deck";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const exists = await prisma.deck.findUnique({ where: { slug: candidate } });
    if (!exists || exists.id === deckId) return candidate;
  }
}

export async function saveDeckAction(payloadJson: string): Promise<{ error?: string }> {
  const user = await requireUser();
  let payload: SaveDeckPayload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { error: "Payload inválido." };
  }

  const title = String(payload.title ?? "").trim();
  if (title.length < 3 || title.length > 80)
    return { error: "O título do deck precisa ter entre 3 e 80 caracteres." };
  const guide = String(payload.guide ?? "").slice(0, 20_000);
  const changelog = String(payload.changelog ?? "").trim().slice(0, 300);
  const declaredType =
    payload.type && TYPES.some((t) => t.id === payload.type) ? payload.type : null;

  const wanted = new Map<string, number>();
  for (const e of payload.entries ?? []) {
    const qty = Math.max(1, Math.min(60, Math.floor(Number(e.quantity) || 0)));
    if (!e.cardId || qty < 1) continue;
    wanted.set(String(e.cardId), (wanted.get(String(e.cardId)) ?? 0) + qty);
  }
  if (wanted.size === 0) return { error: "O deck está vazio." };

  const cards = await prisma.card.findMany({ where: { id: { in: [...wanted.keys()] } } });
  if (cards.length !== wanted.size) return { error: "Alguma carta não foi encontrada na base." };

  const banlist = await getBanlistNormalized();
  const entries: DeckEntry[] = cards.map((c) => ({
    card: cardToGlc(c, banlist),
    quantity: wanted.get(c.id)!,
  }));

  const validation = validateDeck(entries, declaredType);
  if (payload.publish && !validation.ok) {
    return {
      error:
        "O deck não passa na validação GLC — corrija os erros antes de publicar (ou salve como rascunho).",
    };
  }
  const deckType = declaredType ?? validation.deckType;
  if (!deckType) return { error: "Não foi possível inferir o tipo do deck — adicione um Pokémon." };

  const coverCardId =
    payload.coverCardId && wanted.has(payload.coverCardId) ? payload.coverCardId : null;

  let deckId = payload.deckId;
  let slug: string;

  if (deckId) {
    const deck = await prisma.deck.findUnique({ where: { id: deckId }, include: { versions: true } });
    if (!deck || deck.authorUserId !== user.id) return { error: "Deck não encontrado." };
    slug = deck.slug;
    const nextVersion = Math.max(0, ...deck.versions.map((v) => v.version)) + 1;
    await prisma.$transaction([
      prisma.deck.update({
        where: { id: deckId },
        data: {
          title,
          type: deckType,
          guide: guide || null,
          coverCardId,
          isPublic: payload.publish,
          playerId: user.playerId,
        },
      }),
      prisma.deckVersion.create({
        data: {
          deckId,
          version: nextVersion,
          changelog: changelog || null,
          cards: {
            create: entries.map((e) => ({
              cardId: e.card.id,
              rawName: e.card.name,
              quantity: e.quantity,
              category: categoryOf(e.card),
            })),
          },
        },
      }),
    ]);
  } else {
    slug = await uniqueDeckSlug(title);
    const deck = await prisma.deck.create({
      data: {
        slug,
        title,
        type: deckType,
        guide: guide || null,
        coverCardId,
        isPublic: payload.publish,
        source: "BUILDER",
        authorUserId: user.id,
        playerId: user.playerId,
        versions: {
          create: {
            version: 1,
            changelog: changelog || null,
            cards: {
              create: entries.map((e) => ({
                cardId: e.card.id,
                rawName: e.card.name,
                quantity: e.quantity,
                category: categoryOf(e.card),
              })),
            },
          },
        },
      },
    });
    deckId = deck.id;
  }

  revalidatePath("/decks");
  redirect(`/decks/${slug}`);
}

export async function deleteDeckAction(formData: FormData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId") ?? "");
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || (deck.authorUserId !== user.id && user.role !== "ADMIN")) return;
  await prisma.deck.delete({ where: { id: deckId } });
  revalidatePath("/decks");
  redirect("/conta");
}

// ---------------------------------------------------------------------------
// Vincular deck a uma vitória do histórico ("ganhou a insígnia X na loja Y")
// ---------------------------------------------------------------------------

export async function linkResultAction(formData: FormData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId") ?? "");
  const badgeWinId = String(formData.get("badgeWinId") ?? "");

  const [deck, badge] = await Promise.all([
    prisma.deck.findUnique({ where: { id: deckId } }),
    prisma.badgeWin.findUnique({ where: { id: badgeWinId } }),
  ]);
  if (!deck || deck.authorUserId !== user.id) return;
  if (!badge || !user.playerId || badge.playerId !== user.playerId) return;
  if (badge.type !== deck.type) return; // a vitória precisa ser do tipo do deck

  await prisma.$transaction([
    prisma.deckResultLink.upsert({
      where: { deckId_badgeWinId: { deckId, badgeWinId } },
      create: { deckId, badgeWinId },
      update: {},
    }),
    prisma.deck.update({ where: { id: deckId }, data: { isChampion: true } }),
  ]);
  revalidatePath(`/decks/${deck.slug}`);
}

export async function unlinkResultAction(formData: FormData) {
  const user = await requireUser();
  const linkId = String(formData.get("linkId") ?? "");
  const link = await prisma.deckResultLink.findUnique({
    where: { id: linkId },
    include: { deck: true },
  });
  if (!link || link.deck.authorUserId !== user.id) return;
  await prisma.deckResultLink.delete({ where: { id: linkId } });
  const remaining = await prisma.deckResultLink.count({ where: { deckId: link.deckId } });
  if (remaining === 0) {
    await prisma.deck.update({ where: { id: link.deckId }, data: { isChampion: false } });
  }
  revalidatePath(`/decks/${link.deck.slug}`);
}
