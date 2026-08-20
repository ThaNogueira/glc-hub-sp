import { prisma } from "../db";

/** Opções de coleção para o filtro do deck builder (mais recentes primeiro). */
export async function getSetOptions(): Promise<{ id: string; name: string }[]> {
  const sets = await prisma.card.groupBy({
    by: ["setId", "setName", "setReleaseDate"],
    orderBy: { setReleaseDate: "desc" },
  });
  return sets.map((s) => ({ id: s.setId, name: s.setName }));
}
