import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import { AppShell } from "@/components/AppShell";
import { TypeIcon } from "@/components/TypeIcon";
import { getSessionUser } from "@/lib/auth";
import { getDataFreshness } from "@/lib/queries";
import { TYPES } from "@/lib/types";
import "./globals.css";

// Renderização dinâmica: o build da imagem Docker não tem banco disponível,
// então nada é pré-renderizado. Os dados mudam poucas vezes por dia e as
// consultas são baratas; ISR pode ser reativado depois, com build conectado.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "GLC Hub — Gym Leader Challenge São Paulo",
    template: "%s · GLC Hub",
  },
  description:
    "Hub da comunidade de Pokémon TCG Gym Leader Challenge de São Paulo: meta, torneios, rankings, insígnias e decks.",
  openGraph: {
    siteName: "GLC Hub",
    locale: "pt_BR",
    type: "website",
  },
};

// Dark é o padrão; "light" só quando o usuário escolheu explicitamente.
const themeInit = `try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let freshness: Awaited<ReturnType<typeof getDataFreshness>> | null = null;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    [freshness, user] = await Promise.all([getDataFreshness(), getSessionUser()]);
  } catch {
    // banco indisponível (ex.: build sem DB) — shell degrada sem quebrar
  }

  const footer = (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-types" aria-hidden="true">
          {TYPES.map((t) => (
            <TypeIcon key={t.id} type={t.id} size={16} />
          ))}
        </div>
        <p>
          <Link href="/regras">Regras do formato</Link> · <Link href="/creditos">Créditos</Link>{" "}
          · <Link href="/agenda">Agenda</Link> · <Link href="/decks">Decks</Link>
        </p>
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
          , mantida pela comunidade. Ícones de tipo via{" "}
          <a href="https://archives.bulbagarden.net/" target="_blank" rel="noopener noreferrer">
            Bulbagarden Archives
          </a>{" "}
          · imagens de cartas via{" "}
          <a href="https://pokemontcg.io/" target="_blank" rel="noopener noreferrer">
            pokemontcg.io
          </a>
          .
        </p>
        <p>
          Projeto de fã, sem fins lucrativos. Não afiliado à The Pokémon Company, Nintendo,
          Creatures Inc. ou GAME FREAK. Pokémon e os nomes de personagens são marcas de seus
          respectivos donos.
        </p>
      </div>
    </footer>
  );

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AppShell
          user={
            user
              ? { displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl }
              : null
          }
          footer={footer}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
