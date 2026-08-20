import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getDataFreshness } from "@/lib/queries";
import "./globals.css";

// Renderização dinâmica: o build da imagem Docker não tem banco disponível,
// então nada é pré-renderizado. Os dados mudam poucas vezes por dia e as
// consultas são baratas; ISR pode ser reativado depois, com build conectado.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "GLC Hub SP — Gym Leader Challenge São Paulo",
    template: "%s · GLC Hub SP",
  },
  description:
    "Hub da comunidade de Pokémon TCG Gym Leader Challenge de São Paulo: meta, torneios, rankings e insígnias.",
  openGraph: {
    siteName: "GLC Hub SP",
    locale: "pt_BR",
    type: "website",
  },
};

const themeInit = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let freshness: Awaited<ReturnType<typeof getDataFreshness>> | null = null;
  try {
    freshness = await getDataFreshness();
  } catch {
    // banco indisponível (ex.: build sem DB) — o rodapé apenas omite a linha
  }

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
                <path
                  d="M32 3 L57 13 V33 C57 47 46 57 32 61 C18 57 7 47 7 33 V13 Z"
                  fill="var(--accent)"
                />
                <circle cx="32" cy="31" r="10" fill="#fff" />
                <circle cx="32" cy="31" r="5" fill="var(--accent)" />
              </svg>
              GLC Hub SP
            </Link>
            <nav className="main-nav">
              <Link href="/">Meta</Link>
              <Link href="/agenda">Agenda</Link>
              <Link href="/rankings">Rankings</Link>
              <Link href="/jogadores">Jogadores</Link>
              <Link href="/lojas">Lojas</Link>
              <Link href="/regras">Regras</Link>
            </nav>
            <ThemeToggle />
          </div>
        </header>

        <main className="container">{children}</main>

        <footer className="site-footer">
          <div className="container">
            {freshness?.lastSyncAt && (
              <p>
                Dados sincronizados em{" "}
                {freshness.lastSyncAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                {freshness.sheetNotes.length > 0 && (
                  <>
                    {" · planilha: "}
                    {freshness.sheetNotes
                      .map((n) => `${n.title} atualizada em ${n.lastUpdatedNote}`)
                      .join(" · ")}
                  </>
                )}
              </p>
            )}
            <p>
              Fonte dos dados: planilha comunitária{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/1m4bGPteefWIQfjILnZ8iUbHUZj05hxoe_N907GM5c68/"
                target="_blank"
                rel="noopener noreferrer"
              >
                GLC - Circuito SP
              </a>
              , mantida pela comunidade.
            </p>
            <p>
              Projeto de fã, sem fins lucrativos. Não afiliado à The Pokémon Company, Nintendo,
              Creatures Inc. ou GAME FREAK. Pokémon e os nomes de personagens são marcas de seus
              respectivos donos.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
