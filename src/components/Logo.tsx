/**
 * Logo GLC HUB — recriado em SVG vetorial a partir da arte oficial
 * (GLC em itálico com L roxo, HUB entre traços, BRASIL, pokébola no topo
 * e arcos de círculo). Escala sem perder nitidez.
 */

const PURPLE = "#9787d8";
const CREAM = "#f4f1e8";

export function Logo({
  width = 340,
  title = "GLC Hub Brasil",
}: {
  width?: number;
  title?: string;
}) {
  const height = (width * 300) / 460;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 460 300"
      role="img"
      aria-label={title}
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    >
      {/* pokébola no topo */}
      <g stroke={PURPLE} strokeWidth="5" fill="none">
        <circle cx="230" cy="38" r="22" />
        <path d="M208 38 H218 M242 38 H252" />
        <circle cx="230" cy="38" r="8" />
      </g>

      {/* arcos laterais e inferior */}
      <g stroke={PURPLE} strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M178 30 A150 150 0 0 0 82 96" />
        <path d="M282 30 A150 150 0 0 1 378 96" />
        <path d="M112 262 A160 160 0 0 0 348 262" />
      </g>

      {/* GLC */}
      <text
        x="230"
        y="172"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="124"
        letterSpacing="-6"
      >
        <tspan fill={CREAM}>G</tspan>
        <tspan fill={PURPLE}>L</tspan>
        <tspan fill={CREAM}>C</tspan>
      </text>

      {/* HUB entre traços */}
      <g>
        <line x1="96" y1="210" x2="150" y2="210" stroke={PURPLE} strokeWidth="5" strokeLinecap="round" />
        <text
          x="230"
          y="226"
          textAnchor="middle"
          fontFamily="var(--font-display), sans-serif"
          fontWeight="700"
          fontSize="46"
          letterSpacing="14"
          fill={CREAM}
        >
          HUB
        </text>
        <line x1="310" y1="210" x2="364" y2="210" stroke={PURPLE} strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* BRASIL */}
      <text
        x="230"
        y="262"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontWeight="600"
        fontSize="24"
        letterSpacing="9"
        fill={PURPLE}
      >
        BRASIL
      </text>
    </svg>
  );
}

/** Marca compacta (pokébola + GLC HUB em linha) para o menu lateral/topbar. */
export function LogoMark({ height = 30 }: { height?: number }) {
  const width = (height * 150) / 36;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 150 36"
      role="img"
      aria-label="GLC Hub"
      style={{ display: "block" }}
    >
      <g stroke={PURPLE} strokeWidth="2.6" fill="none">
        <circle cx="16" cy="18" r="11" />
        <path d="M5 18 H10 M22 18 H27" />
        <circle cx="16" cy="18" r="4" />
      </g>
      <text
        x="36"
        y="27"
        fontFamily="var(--font-display), sans-serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="24"
        letterSpacing="-1"
      >
        <tspan fill="var(--text)">G</tspan>
        <tspan fill={PURPLE}>L</tspan>
        <tspan fill="var(--text)">C</tspan>
        <tspan fill="var(--text)" fontStyle="normal" fontSize="17" dx="7" letterSpacing="3">
          HUB
        </tspan>
      </text>
    </svg>
  );
}
