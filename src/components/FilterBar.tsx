import type { MetaFilters } from "@/lib/queries";

type VenueOption = { slug: string; name: string; kind: string };

/**
 * Filtros comuns (modalidade / loja / temporada) como form GET — funciona sem
 * JavaScript e mantém as URLs compartilháveis.
 */
export function FilterBar({
  filters,
  venues,
  action,
  extra,
}: {
  filters: MetaFilters;
  venues: VenueOption[];
  action: string;
  extra?: React.ReactNode;
}) {
  return (
    <form className="filter-bar" method="get" action={action}>
      <label>
        Modalidade
        <select name="modalidade" defaultValue={filters.modality ?? ""}>
          <option value="">Todas</option>
          <option value="presencial">Presencial</option>
          <option value="online">Online</option>
        </select>
      </label>
      <label>
        Loja / evento
        <select name="loja" defaultValue={filters.venue ?? ""}>
          <option value="">Todas</option>
          {venues.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.name}
              {v.kind === "EVENT" ? " (evento)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Temporada
        <select name="temporada" defaultValue={filters.season ?? ""}>
          <option value="">Tudo</option>
          <option value="2026">Temporada 2026</option>
          <option value="historico">Histórico (até 2025)</option>
        </select>
      </label>
      {extra}
      <button type="submit" className="secondary">
        Filtrar
      </button>
    </form>
  );
}
